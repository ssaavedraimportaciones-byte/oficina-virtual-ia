import type Anthropic from "@anthropic-ai/sdk";
import { withTenant } from "@pronex/db";
import { AppError, type SendRequest } from "@pronex/messaging";
import type { Pool, PoolClient } from "pg";
import { fallbackParams, isRetryableModelError, type ModelClient } from "./model.js";
import { checkReply } from "./guardrail.js";
import { usageCost } from "./pricing.js";
import { buildSystem, buildUserTurn, finalText, NO_REPLY_MARKER } from "./prompt.js";
import { executeTool, toolDefinitionsFor, type TurnEffects } from "./tools.js";

export interface RuntimeDeps {
  pool: Pool;
  model: ModelClient;
  /** Envía un mensaje al cliente (en producción: sendMessage de @pronex/messaging). */
  send(req: SendRequest): Promise<{ id: string } | undefined>;
}

export interface TurnInput {
  tenantId: string;
  conversationId: string;
}

export type TurnStatus =
  | "nothing_to_do" | "replied" | "no_reply" | "handoff" | "skipped" | "refused" | "budget_exceeded" | "failed";

export interface TurnOutcome {
  status: TurnStatus;
  runId: string | null;
}

/** Aviso al cliente cuando el agente se retira sin respuesta propia (error, negativa, límites). */
export const HANDOFF_NOTICE = "¡Gracias por escribirnos! Una persona del equipo continuará la conversación en breve.";

const MAX_TOKENS = 8000;

interface Version {
  id: string;
  prompt: string;
  model: string;
  tools: string[];
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  max_steps: number;
  conversation_budget_usd: string;
}

interface Run {
  id: string;
  steps: number;
  handoff_reason: string | null;
  reply_message_id: string | null;
}

interface Conversation {
  id: string;
  pinned_version_id: string | null;
  status: string;
  owner: "agent" | "human";
  lead_id: string;
  lead_name: string | null;
  lead_phone: string | null;
  agent_id: string | null;
}

/**
 * Ejecuta un turno del agente para una conversación.
 *
 * Es reanudable: cada paso (turno del usuario, respuesta del modelo, resultados de
 * herramientas) se persiste en la transcripción antes de seguir. Si el proceso
 * muere y Temporal reintenta, el turno continúa desde el último paso guardado, sin
 * duplicar el turno del usuario ni perder llamadas ya pagadas al modelo.
 */
export async function runAgentTurn(deps: RuntimeDeps, input: TurnInput): Promise<TurnOutcome> {
  const started = await withTenant(deps.pool, input.tenantId, (c) => beginTurn(c, input));
  if (started.kind === "done") return started.outcome;
  // Sin llamada al modelo: solo aviso + handoff. No toca la transcripción, así nunca
  // se reenvía por error la respuesta de un turno anterior.
  if (started.kind === "budget") return finish(deps, input, started.run, "budget_exceeded", null, started.reason);
  const { run, version, conversation } = started;

  try {
    return await driveTurn(deps, input, run, version, conversation);
  } catch (err) {
    if (err instanceof AppError || !isRetryableModelError(err)) {
      await failAgentTurn(deps, input, err);
      return { status: "failed", runId: run.id };
    }
    throw err; // transitorio: que Temporal reintente la actividad
  }
}

type Begin =
  | { kind: "done"; outcome: TurnOutcome }
  | { kind: "budget"; run: Run; reason: string }
  | { kind: "run"; run: Run; version: Version; conversation: Conversation };

async function beginTurn(c: PoolClient, input: TurnInput): Promise<Begin> {
  const { rows: [conv] } = await c.query<Conversation>(
    `select c.id, c.status, c.owner, c.lead_id, c.agent_id, c.pinned_version_id, l.full_name as lead_name, l.phone as lead_phone
     from conversations c join leads l on l.tenant_id = c.tenant_id and l.id = c.lead_id
     where c.id = $1 for update of c`,
    [input.conversationId],
  );
  const nothing = { kind: "done", outcome: { status: "nothing_to_do", runId: null } } as const;
  if (!conv || conv.status !== "open") return nothing;

  // ¿Hay un turno a medio camino (crash, reintento)? Se retoma tal cual, con su versión.
  const { rows: [running] } = await c.query<Run & { agent_version_id: string | null }>(
    `select id, steps, handoff_reason, reply_message_id, agent_version_id
     from agent_runs where conversation_id = $1 and status = 'running'`,
    [conv.id],
  );
  const version = running?.agent_version_id
    ? await versionById(c, running.agent_version_id)
    : await resolveVersion(c, conv);
  if (running && version) {
    const { rows: [own] } = await c.query<{ n: number }>(
      "select count(*)::int as n from agent_transcripts where run_id = $1", [running.id],
    );
    // Una ejecución sin transcripción propia es un corte por presupuesto a medio cerrar.
    if (own!.n === 0) return { kind: "budget", run: running, reason: running.handoff_reason ?? "presupuesto agotado" };
    return { kind: "run", run: running, version, conversation: conv };
  }

  // Mientras un humano atiende, el agente no lee: los mensajes quedan para cuando se libere.
  if (conv.owner === "human" || !version) {
    return { kind: "done", outcome: { status: "skipped", runId: null } };
  }

  const { rows: pending } = await c.query<{ id: string; body: string | null; type: string; direction: string; created_at: Date }>(
    `select id, body, coalesce(payload->>'type', 'text') as type, direction, created_at from messages
     where conversation_id = $1 and direction = 'inbound' and agent_run_id is null
     order by created_at, id`,
    [conv.id],
  );
  if (!pending.length) return nothing;

  const runRow = async (extra: { handoff?: string } = {}) => {
    const { rows: [r] } = await c.query<Run>(
      `insert into agent_runs (tenant_id, conversation_id, agent_version_id, status, model_requested, handoff_reason)
       values ($1, $2, $3, 'running', $4, $5)
       returning id, steps, handoff_reason, reply_message_id`,
      [input.tenantId, conv.id, version.id, version.model, extra.handoff ?? null],
    );
    await c.query("update messages set agent_run_id = $2 where id = any($1::uuid[])", [pending.map((p) => p.id), r!.id]);
    return r!;
  };

  // Presupuestos: por conversación (de la versión) y diario por tenant.
  const { rows: [spend] } = await c.query<{ conversation: string; today: string; daily_budget: string }>(
    `select
       (select coalesce(sum(cost_usd), 0) from agent_runs where conversation_id = $1) as conversation,
       (select coalesce(sum(cost_usd), 0) from agent_runs where started_at >= date_trunc('day', now())) as today,
       (select daily_llm_budget_usd from tenants where id = $2) as daily_budget`,
    [conv.id, input.tenantId],
  );
  const overConversation = Number(spend!.conversation) >= Number(version.conversation_budget_usd);
  const overDaily = Number(spend!.today) >= Number(spend!.daily_budget);
  if (overConversation || overDaily) {
    const reason = overConversation ? "presupuesto de la conversación agotado" : "presupuesto diario del tenant agotado";
    return { kind: "budget", run: await runRow({ handoff: reason }), reason };
  }

  const run = await runRow();

  // Si un humano escribió desde el último turno del agente, se le da contexto al modelo.
  const { rows: humanMsgs } = await c.query<{ id: string; body: string | null; created_at: Date }>(
    `select id, body, created_at from messages
     where conversation_id = $1 and direction = 'outbound' and sender = 'human'
       and created_at > coalesce((select max(started_at) from agent_runs where conversation_id = $1 and id <> $2), '-infinity')`,
    [conv.id, run.id],
  );
  const timeline = [
    ...pending.map((m) => ({ ...m, from: "lead" as const })),
    ...humanMsgs.map((m) => ({ ...m, type: "text", from: "human" as const })),
  ].sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  const labeled = humanMsgs.length > 0;

  const { rows: [prior] } = await c.query<{ n: number }>(
    "select count(*)::int as n from agent_transcripts where conversation_id = $1", [conv.id],
  );
  const content = buildUserTurn(
    timeline.map((m) => ({
      type: m.type,
      body: labeled ? `${m.from === "lead" ? "Cliente" : "Equipo (persona)"}: ${m.body ?? `[${m.type}]`}` : m.body,
    })),
    { name: conv.lead_name, phone: conv.lead_phone },
    prior!.n === 0,
  );
  await appendTranscript(c, input, run.id, "user", content, null);
  return { kind: "run", run, version, conversation: conv };
}

/**
 * Versión que atiende la conversación: la fijada (evals), la canary para un % estable
 * de conversaciones (mismo hash → siempre el mismo lado) o la publicada. Sin versión
 * publicada, el agente no responde.
 */
async function resolveVersion(c: PoolClient, conv: Conversation): Promise<Version | null> {
  if (conv.pinned_version_id) return versionById(c, conv.pinned_version_id);
  if (!conv.agent_id) return null;
  const { rows: [pick] } = await c.query<{ id: string | null }>(
    `select case
       when canary_version_id is not null and mod(abs(hashtext($2::text)), 100) < canary_percent then canary_version_id
       else published_version_id end as id
     from agents where id = $1`,
    [conv.agent_id, conv.id],
  );
  return pick?.id ? versionById(c, pick.id) : null;
}

async function versionById(c: PoolClient, id: string): Promise<Version | null> {
  const { rows: [v] } = await c.query<Version>(
    `select id, prompt, model, tools, effort, max_steps, conversation_budget_usd from agent_versions where id = $1`,
    [id],
  );
  if (!v) return null;
  return { ...v, tools: Array.isArray(v.tools) ? v.tools.filter((t): t is string => typeof t === "string") : [] };
}

async function appendTranscript(
  c: PoolClient, input: TurnInput, runId: string, role: "user" | "assistant", content: unknown, stopReason: string | null,
) {
  await c.query(
    `insert into agent_transcripts (tenant_id, conversation_id, run_id, role, content, stop_reason)
     values ($1, $2, $3, $4, $5, $6)`,
    [input.tenantId, input.conversationId, runId, role, JSON.stringify(content), stopReason],
  );
}

interface TranscriptRow {
  role: "user" | "assistant";
  content: Anthropic.Beta.BetaContentBlockParam[] & Anthropic.Beta.BetaContentBlock[];
  stop_reason: string | null;
}

async function driveTurn(
  deps: RuntimeDeps, input: TurnInput, run: Run, version: Version, conv: Conversation,
): Promise<TurnOutcome> {
  const effects: TurnEffects = { handoffReason: run.handoff_reason };
  let steps = run.steps;
  const tools = toolDefinitionsFor(version.tools);

  for (;;) {
    const transcript = await withTenant(deps.pool, input.tenantId, (c) =>
      c.query<TranscriptRow>(
        "select role, content, stop_reason from agent_transcripts where conversation_id = $1 order by id",
        [input.conversationId],
      ),
    );
    const last = transcript.rows.at(-1);
    if (!last) throw new AppError(500, "empty_transcript");

    const pendingTools = last.role === "assistant"
      ? last.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
      : [];

    if (last.role === "assistant" && pendingTools.length === 0 && last.stop_reason !== "pause_turn") {
      // El modelo terminó: fase de entrega.
      if (last.stop_reason === "refusal") return finish(deps, input, run, "refused", null, "el modelo declinó responder");
      if (last.stop_reason === "max_tokens") return finish(deps, input, run, "failed", null, "respuesta truncada (max_tokens)");
      return finish(deps, input, run, "replied", finalText(last.content), effects.handoffReason, { businessFacts: version.prompt });
    }

    if (pendingTools.length > 0) {
      // Ejecuta herramientas y guarda todos los resultados en un solo turno de usuario.
      await withTenant(deps.pool, input.tenantId, async (c) => {
        const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        for (const block of pendingTools) {
          results.push(await executeTool(block, version.tools, {
            db: c, tenantId: input.tenantId, conversationId: input.conversationId, leadId: conv.lead_id, effects,
          }));
        }
        await appendTranscript(c, input, run.id, "user", results, null);
        await c.query("update agent_runs set handoff_reason = $2 where id = $1", [run.id, effects.handoffReason]);
      });
      continue;
    }

    if (steps >= version.max_steps) {
      return finish(deps, input, run, "handoff", null, `límite de ${version.max_steps} pasos del agente alcanzado`);
    }

    const response = await deps.model.create({
      model: version.model,
      max_tokens: MAX_TOKENS,
      system: buildSystem(version.prompt),
      ...(tools.length ? { tools } : {}),
      messages: transcript.rows.map((r) => ({ role: r.role, content: r.content })),
      output_config: { effort: version.effort },
      cache_control: { type: "ephemeral" },
      ...fallbackParams(version.model),
    });

    const cost = usageCost(response.model, response.usage);
    steps++;
    await withTenant(deps.pool, input.tenantId, async (c) => {
      await appendTranscript(c, input, run.id, "assistant", response.content, response.stop_reason);
      await c.query(
        `update agent_runs set steps = steps + 1,
           input_tokens = input_tokens + $2, output_tokens = output_tokens + $3,
           cache_read_tokens = cache_read_tokens + $4, cache_write_tokens = cache_write_tokens + $5,
           cost_usd = cost_usd + $6,
           models_served = case when $7 = any(models_served) then models_served else array_append(models_served, $7) end
         where id = $1`,
        [run.id, cost.inputTokens, cost.outputTokens, cost.cacheReadTokens, cost.cacheWriteTokens, cost.costUsd, response.model],
      );
    });
  }
}

/**
 * Fase de entrega: envía la respuesta (una sola vez aunque se reintente), aplica el
 * handoff si corresponde y cierra la ejecución.
 */
async function finish(
  deps: RuntimeDeps, input: TurnInput, run: Run, status: TurnStatus, reply: string | null, handoffReason: string | null,
  guard?: { businessFacts: string },
): Promise<TurnOutcome> {
  const wantsHandoff = handoffReason !== null || status === "refused" || status === "failed" || status === "budget_exceeded";
  let text = reply && reply !== NO_REPLY_MARKER ? reply : null;

  // Guardrail: toda respuesta escrita por el modelo se revisa antes de salir.
  if (guard && text && !run.reply_message_id) {
    const verdict = await withTenant(deps.pool, input.tenantId, async (c) => {
      const { rows: [ctx] } = await c.query<{ customer: string | null; latest: string | null }>(
        `select
           (select string_agg(coalesce(body, ''), E'\n' order by created_at) from messages
             where conversation_id = $1 and direction = 'inbound')
           || E'\n' || coalesce((select concat_ws(' ', l.phone, l.email) from conversations c
             join leads l on l.tenant_id = c.tenant_id and l.id = c.lead_id where c.id = $1), '') as customer,
           (select string_agg(coalesce(body, ''), E'\n' order by created_at) from messages
             where agent_run_id = $2) as latest`,
        [input.conversationId, run.id],
      );
      const g = checkReply({
        reply: text!, businessFacts: guard.businessFacts, customerText: ctx?.customer ?? "", latestInbound: ctx?.latest ?? undefined,
      });
      for (const f of g.findings) {
        await c.query(
          `insert into guardrail_events (tenant_id, conversation_id, rule, verdict, detail) values ($1, $2, $3, $4, $5)`,
          [input.tenantId, input.conversationId, f.rule, f.verdict, { ...f.detail, runId: run.id, latencyMs: g.latencyMs }],
        );
      }
      return g;
    });
    if (verdict.verdict === "block") {
      text = HANDOFF_NOTICE;
      handoffReason ??= `guardrail: ${verdict.findings.filter((f) => f.verdict === "block").map((f) => f.rule).join(", ")}`;
    }
  }
  // Si el agente se retira sin haber escrito nada propio, el cliente recibe un aviso.
  if (!text && wantsHandoff) text = HANDOFF_NOTICE;

  let finalStatus: TurnStatus = status;
  let replyId = run.reply_message_id;
  if (text && !replyId) {
    try {
      const sent = await deps.send({
        tenantId: input.tenantId, conversationId: input.conversationId, sender: "agent", content: { text },
      });
      replyId = sent?.id ?? null;
      await withTenant(deps.pool, input.tenantId, (c) =>
        c.query("update agent_runs set reply_message_id = $2 where id = $1", [run.id, replyId]),
      );
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      if (err.code === "human_owns_conversation" || err.code === "conversation_closed") {
        finalStatus = "skipped"; // un humano tomó la conversación mientras el agente pensaba
      } else if (err.code === "outside_service_window") {
        handoffReason ??= "fuera de la ventana de 24 h de WhatsApp";
      } else if (err.status >= 500) {
        throw err; // proveedor caído: reintentar la entrega
      } else {
        handoffReason ??= `no se pudo enviar la respuesta (${err.code})`;
      }
    }
  }
  if (finalStatus === "replied" && !text) finalStatus = "no_reply";
  const doHandoff = finalStatus !== "skipped" && (wantsHandoff || handoffReason !== null);
  if (doHandoff && (finalStatus === "replied" || finalStatus === "no_reply")) finalStatus = "handoff";

  await withTenant(deps.pool, input.tenantId, async (c) => {
    if (doHandoff) {
      const r = await c.query("update conversations set owner = 'human' where id = $1 and owner = 'agent' returning id", [input.conversationId]);
      if (r.rowCount) {
        await c.query(
          "insert into audit_log (tenant_id, actor, action, target, detail) values ($1, $2, 'conversation.handoff', $3, $4)",
          [input.tenantId, `agent_run:${run.id}`, input.conversationId, { reason: handoffReason ?? finalStatus }],
        );
      }
    }
    await c.query(
      `update agent_runs set status = $2, handoff_reason = $3, finished_at = now() where id = $1`,
      [run.id, finalStatus, doHandoff ? handoffReason ?? finalStatus : null],
    );
  });
  return { status: finalStatus, runId: run.id };
}

/**
 * Camino de error definitivo (error no reintentable, o reintentos agotados en
 * Temporal): cierra la ejecución como fallida, avisa al cliente y pasa a un humano.
 */
export async function failAgentTurn(deps: RuntimeDeps, input: TurnInput, error: unknown): Promise<TurnOutcome> {
  const { rows: [run] } = await withTenant(deps.pool, input.tenantId, async (c) => {
    const detail = {
      message: error instanceof Error ? error.message : String(error),
      name: (error as object)?.constructor?.name ?? "unknown",
    };
    return c.query<Run>(
      `update agent_runs set error = $2 where conversation_id = $1 and status = 'running'
       returning id, steps, handoff_reason, reply_message_id`,
      [input.conversationId, detail],
    );
  });
  if (!run) return { status: "nothing_to_do", runId: null };
  return finish(deps, input, run, "failed", null, "error del agente");
}
