import { randomUUID } from "node:crypto";
import { withTenant } from "@pronex/db";
import type { Pool } from "pg";
import type { ModelClient } from "./model.js";
import { runAgentTurn, type TurnStatus } from "./runtime.js";

/** Lo que se espera de un caso dorado. Todos los campos son opcionales. */
export interface Expectations {
  /** Frases que deben aparecer en alguna respuesta (sin distinguir mayúsculas). */
  must_contain?: string[];
  /** Frases que no deben aparecer en ninguna respuesta. */
  must_not_contain?: string[];
  /** true: debe terminar en manos de una persona; false: no debe. */
  expect_handoff?: boolean;
  /** Gasto máximo del caso completo, en USD. */
  max_cost_usd?: number;
}

export interface GoldenCase {
  id?: string;
  name: string;
  /** Mensajes del cliente; cada uno es un turno. */
  turns: string[];
  expectations: Expectations;
}

export interface CaseResult {
  name: string;
  passed: boolean;
  failures: string[];
  replies: string[];
  statuses: TurnStatus[];
  handoff: boolean;
  costUsd: number;
}

export interface GoldenDeps {
  pool: Pool;
  model: ModelClient;
}

/**
 * Ejecuta un caso con el runtime real (misma lógica, herramientas y guardrail que
 * en producción) sobre una conversación de prueba fijada a la versión evaluada.
 * Las respuestas se capturan en vez de enviarse por WhatsApp.
 */
export async function runGoldenCase(
  deps: GoldenDeps, target: { tenantId: string; agentId: string; versionId: string }, gc: GoldenCase,
): Promise<CaseResult> {
  const replies: string[] = [];
  const statuses: TurnStatus[] = [];
  const conversationId = await withTenant(deps.pool, target.tenantId, async (c) => {
    const { rows: [ws] } = await c.query<{ workspace_id: string }>("select workspace_id from agents where id = $1", [target.agentId]);
    if (!ws) throw new Error("agente no encontrado");
    const { rows: [lead] } = await c.query<{ id: string }>(
      "insert into leads (tenant_id, workspace_id, full_name) values ($1, $2, $3) returning id",
      [target.tenantId, ws.workspace_id, `[eval] ${gc.name}`],
    );
    const { rows: [conv] } = await c.query<{ id: string }>(
      `insert into conversations (tenant_id, lead_id, channel, agent_id, pinned_version_id, is_sandbox, last_inbound_at)
       values ($1, $2, 'web', $3, $4, true, now()) returning id`,
      [target.tenantId, lead!.id, target.agentId, target.versionId],
    );
    return conv!.id;
  });

  const runtime = {
    pool: deps.pool,
    model: deps.model,
    async send(req: { content: { text: string } | { template: unknown } }) {
      if ("text" in req.content) replies.push(req.content.text);
      return { id: randomUUID() };
    },
  };

  for (const turn of gc.turns) {
    await withTenant(deps.pool, target.tenantId, (c) =>
      c.query(
        `insert into messages (tenant_id, conversation_id, direction, channel, body, sender, payload)
         values ($1, $2, 'inbound', 'web', $3, 'lead', '{"type":"text"}')`,
        [target.tenantId, conversationId, turn],
      ),
    );
    statuses.push((await runAgentTurn(runtime, { tenantId: target.tenantId, conversationId })).status);
  }

  const summary = await withTenant(deps.pool, target.tenantId, async (c) => {
    const { rows: [s] } = await c.query<{ owner: string; cost: string }>(
      `select c.owner, (select coalesce(sum(cost_usd), 0) from agent_runs where conversation_id = c.id) as cost
       from conversations c where c.id = $1`,
      [conversationId],
    );
    await c.query("update conversations set status = 'closed' where id = $1", [conversationId]);
    return s!;
  });

  const e = gc.expectations;
  const all = replies.join("\n").toLowerCase();
  const failures: string[] = [];
  for (const phrase of e.must_contain ?? []) {
    if (!all.includes(phrase.toLowerCase())) failures.push(`falta "${phrase}"`);
  }
  for (const phrase of e.must_not_contain ?? []) {
    if (all.includes(phrase.toLowerCase())) failures.push(`no debía decir "${phrase}"`);
  }
  const handoff = summary.owner === "human";
  if (e.expect_handoff !== undefined && e.expect_handoff !== handoff) {
    failures.push(e.expect_handoff ? "debía pasar a una persona y no lo hizo" : "pasó a una persona sin que correspondiera");
  }
  const costUsd = Number(summary.cost);
  if (e.max_cost_usd !== undefined && costUsd > e.max_cost_usd) {
    failures.push(`costó USD ${costUsd.toFixed(4)} (máximo ${e.max_cost_usd})`);
  }
  if (statuses.includes("failed")) failures.push("un turno terminó con error");

  return { name: gc.name, passed: failures.length === 0, failures, replies, statuses, handoff, costUsd };
}

export interface EvalRunResult {
  id: string;
  status: "passed" | "failed" | "error";
  total: number;
  passed: number;
  costUsd: number;
  results: CaseResult[];
}

/** Corre todos los casos dorados del agente contra una versión y guarda el resultado. */
export async function runGoldenSuite(
  deps: GoldenDeps, target: { tenantId: string; agentId: string; versionId: string },
): Promise<EvalRunResult> {
  const { cases, runId } = await withTenant(deps.pool, target.tenantId, async (c) => {
    const { rows } = await c.query<{ id: string; name: string; turns: string[]; expectations: Expectations }>(
      "select id, name, turns, expectations from golden_cases where agent_id = $1 order by name", [target.agentId],
    );
    const { rows: [run] } = await c.query<{ id: string }>(
      "insert into eval_runs (tenant_id, agent_version_id, total) values ($1, $2, $3) returning id",
      [target.tenantId, target.versionId, rows.length],
    );
    return { cases: rows, runId: run!.id };
  });

  const results: CaseResult[] = [];
  let status: EvalRunResult["status"] = "passed";
  try {
    for (const gc of cases) results.push(await runGoldenCase(deps, target, gc));
    if (results.some((r) => !r.passed)) status = "failed";
  } catch (err) {
    status = "error";
    results.push({
      name: "(error de ejecución)", passed: false, failures: [(err as Error).message],
      replies: [], statuses: [], handoff: false, costUsd: 0,
    });
  }
  const passed = results.filter((r) => r.passed).length;
  const costUsd = results.reduce((a, r) => a + r.costUsd, 0);
  await withTenant(deps.pool, target.tenantId, (c) =>
    c.query(
      `update eval_runs set status = $2, passed = $3, cost_usd = $4, results = $5, finished_at = now() where id = $1`,
      [runId, status, passed, costUsd, JSON.stringify(results)],
    ),
  );
  return { id: runId, status, total: cases.length, passed, costUsd, results };
}
