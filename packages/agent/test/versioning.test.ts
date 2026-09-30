import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { withTenant } from "@pronex/db";
import { freshDatabase } from "@pronex/db/testing";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runAgentTurn, type CreateParams, type ModelClient, type RuntimeDeps } from "../src/index.js";

let admin: pg.Client;
let pool: pg.Pool;
let deps: RuntimeDeps;
const seen: string[] = []; // qué prompt de versión recibió el modelo en cada llamada
let failNext = false;

const model: ModelClient = {
  async create(params: CreateParams) {
    const agentBlock = (params.system as Anthropic.Beta.BetaTextBlockParam[])[1]!.text;
    seen.push(agentBlock.includes("VERSION-2") ? "v2" : "v1");
    if (failNext) {
      failNext = false;
      throw new Anthropic.APIConnectionError({ message: "timeout" });
    }
    return {
      id: `msg_${randomUUID()}`, type: "message", role: "assistant", model: "claude-opus-5-5",
      content: [{ type: "text", text: "ok", citations: null }], stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    } as unknown as Anthropic.Beta.BetaMessage;
  },
};

let tenantId = "";
let agentId = "";
let v1 = "";
let v2 = "";

async function newConversation(): Promise<string> {
  return withTenant(pool, tenantId, async (c) => {
    const ws = (await c.query("select workspace_id from agents where id = $1", [agentId])).rows[0].workspace_id;
    const lead = (await c.query("insert into leads (tenant_id, workspace_id) values ($1, $2) returning id", [tenantId, ws])).rows[0].id;
    return (await c.query(
      "insert into conversations (tenant_id, lead_id, channel, agent_id, last_inbound_at) values ($1, $2, 'web', $3, now()) returning id",
      [tenantId, lead, agentId],
    )).rows[0].id;
  });
}

async function turn(conversationId: string): Promise<string> {
  await withTenant(pool, tenantId, (c) =>
    c.query(
      "insert into messages (tenant_id, conversation_id, direction, channel, body, payload) values ($1, $2, 'inbound', 'web', 'hola', '{}')",
      [tenantId, conversationId],
    ),
  );
  const out = await runAgentTurn(deps, { tenantId, conversationId });
  const { rows: [r] } = await admin.query("select agent_version_id from agent_runs where id = $1", [out.runId]);
  return r.agent_version_id === v2 ? "v2" : "v1";
}

beforeAll(async () => {
  ({ admin, app: pool } = await freshDatabase());
  deps = { pool, model, send: async () => ({ id: randomUUID() }) };
  tenantId = randomUUID();
  await withTenant(pool, tenantId, async (c) => {
    await c.query("insert into tenants (id, name, daily_llm_budget_usd) values ($1, 'T', 1000)", [tenantId]);
    const ws = (await c.query("insert into workspaces (tenant_id, name) values ($1, 'w') returning id", [tenantId])).rows[0].id;
    agentId = (await c.query("insert into agents (tenant_id, workspace_id, name) values ($1, $2, 'a') returning id", [tenantId, ws])).rows[0].id;
    const ins = (n: number) => c.query(
      "insert into agent_versions (tenant_id, agent_id, version, prompt, model) values ($1, $2, $3, $4, 'claude-opus-5-5') returning id",
      [tenantId, agentId, n, `Prompt VERSION-${n}`],
    ).then((r) => r.rows[0].id as string);
    v1 = await ins(1);
    v2 = await ins(2);
  });
});

afterAll(async () => {
  await pool?.end();
  await admin?.end();
});

describe("selección de versión", () => {
  it("sin versión publicada, el agente no responde", async () => {
    const conv = await newConversation();
    await withTenant(pool, tenantId, (c) =>
      c.query("insert into messages (tenant_id, conversation_id, direction, channel, body, payload) values ($1, $2, 'inbound', 'web', 'hola', '{}')", [tenantId, conv]),
    );
    expect((await runAgentTurn(deps, { tenantId, conversationId: conv })).status).toBe("skipped");
  });

  it("canary al 50 %: reparto cercano al porcentaje y cada conversación siempre del mismo lado", async () => {
    await admin.query("update agents set published_version_id = $2, canary_version_id = $3, canary_percent = 50 where id = $1", [agentId, v1, v2]);
    const convs = await Promise.all(Array.from({ length: 80 }, () => newConversation()));
    const first: string[] = [];
    for (const c of convs) first.push(await turn(c));
    const onCanary = first.filter((v) => v === "v2").length;
    expect(onCanary).toBeGreaterThan(20);
    expect(onCanary).toBeLessThan(60);

    // Segundo turno: ninguna conversación cambia de versión.
    for (let i = 0; i < convs.length; i++) expect(await turn(convs[i]!)).toBe(first[i]);
    // Y el modelo recibió el prompt de la versión correspondiente.
    expect(seen.filter((v) => v === "v2").length).toBe(onCanary * 2);
  });

  it("rollback: afecta de inmediato también a conversaciones en curso", async () => {
    const convs = await Promise.all(Array.from({ length: 20 }, () => newConversation()));
    for (const c of convs) await turn(c);
    await admin.query("update agents set published_version_id = $2, canary_version_id = null, canary_percent = 0 where id = $1", [agentId, v1]);
    for (const c of convs) expect(await turn(c)).toBe("v1");
  });

  it("un turno reanudado termina con la versión con que empezó, aunque se publique otra entremedio", async () => {
    const conv = await newConversation();
    failNext = true;
    seen.length = 0;
    await withTenant(pool, tenantId, (c) =>
      c.query("insert into messages (tenant_id, conversation_id, direction, channel, body, payload) values ($1, $2, 'inbound', 'web', 'hola', '{}')", [tenantId, conv]),
    );
    await expect(runAgentTurn(deps, { tenantId, conversationId: conv })).rejects.toThrow();
    await admin.query("update agents set published_version_id = $2 where id = $1", [agentId, v2]); // publicación a mitad de turno
    const out = await runAgentTurn(deps, { tenantId, conversationId: conv });
    expect(out.status).toBe("replied");
    expect(seen).toEqual(["v1", "v1"]);
    // El siguiente turno ya usa la nueva versión publicada.
    expect(await turn(conv)).toBe("v2");
  });
});
