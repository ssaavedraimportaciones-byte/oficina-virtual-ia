import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { SecretBox } from "@pronex/auth";
import { WhatsAppClient } from "@pronex/channels";
import { withTenant } from "@pronex/db";
import { freshDatabase } from "@pronex/db/testing";
import { credentialsAad, ingestInbound, sendMessage } from "@pronex/messaging";
import type pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  FALLBACK_BETA, HANDOFF_NOTICE, NO_REPLY_MARKER, PLATFORM_RULES, runAgentTurn, usageCost,
  type CreateParams, type ModelClient, type RuntimeDeps,
} from "../src/index.js";

let admin: pg.Client;
let pool: pg.Pool;
let deps: RuntimeDeps;

// --- Modelo guionado --------------------------------------------------------

type Step = Anthropic.Beta.BetaMessage | Error;
const script: Step[] = [];
const calls: CreateParams[] = [];

function reply(content: Anthropic.Beta.BetaContentBlock[], stop: Anthropic.Beta.BetaStopReason = "end_turn", model = "claude-opus-5-5") {
  return {
    id: `msg_${randomUUID()}`, type: "message", role: "assistant", model, content, stop_reason: stop, stop_sequence: null,
    usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 5000, cache_creation_input_tokens: 0 },
  } as unknown as Anthropic.Beta.BetaMessage;
}
const text = (t: string) => ({ type: "text", text: t, citations: null }) as Anthropic.Beta.BetaTextBlock;
const toolUse = (name: string, input: object) =>
  ({ type: "tool_use", id: `toolu_${randomUUID().slice(0, 8)}`, name, input }) as Anthropic.Beta.BetaToolUseBlock;

const model: ModelClient = {
  async create(params) {
    calls.push(structuredClone(params));
    const next = script.shift();
    if (!next) throw new Error("el guion del modelo se agotó");
    if (next instanceof Error) throw next;
    return next;
  },
};

// --- WhatsApp falso ---------------------------------------------------------

const sentToMeta: string[] = [];
const whatsapp = new WhatsAppClient({
  fetch: (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    sentToMeta.push(body.text?.body ?? `[template:${body.template?.name}]`);
    return new Response(JSON.stringify({ messages: [{ id: `wamid.out.${randomUUID()}` }] }), { status: 200 });
  }) as unknown as typeof fetch,
});

// --- Datos ------------------------------------------------------------------

interface Fixture { tenantId: string; agentId: string; versionId: string; phoneId: string }

async function seed(opts: { tools?: string[]; maxSteps?: number; budget?: number } = {}): Promise<Fixture> {
  const tenantId = randomUUID();
  const phoneId = String(Math.floor(Math.random() * 1e12));
  const box = secretBox;
  return withTenant(pool, tenantId, async (c) => {
    await c.query("insert into tenants (id, name) values ($1, 'PyME')", [tenantId]);
    const ws = (await c.query("insert into workspaces (tenant_id, name) values ($1, 'main') returning id", [tenantId])).rows[0].id;
    const agentId = (await c.query("insert into agents (tenant_id, workspace_id, name) values ($1, $2, 'Ventas') returning id", [tenantId, ws])).rows[0].id;
    const versionId = (await c.query(
      `insert into agent_versions (tenant_id, agent_id, version, prompt, model, tools, max_steps, conversation_budget_usd)
       values ($1, $2, 1, 'Vendes el plan Pro a USD 49/mes.', 'claude-opus-5-5', $3, $4, $5) returning id`,
      [tenantId, agentId, JSON.stringify(opts.tools ?? ["handoff_to_human", "update_lead"]), opts.maxSteps ?? 6, opts.budget ?? 0.5],
    )).rows[0].id;
    await c.query(
      `insert into channel_accounts (tenant_id, workspace_id, channel, external_id, credentials_enc, agent_id)
       values ($1, $2, 'whatsapp', $3, $4, $5)`,
      [tenantId, ws, phoneId, box.seal("EAAG-token", credentialsAad(tenantId)), agentId],
    );
    return { tenantId, agentId, versionId, phoneId };
  });
}

let msgSeq = 0;
async function inbound(f: Fixture, body: string, from = "+56987654321") {
  const r = await ingestInbound(pool, {
    channel: "whatsapp", accountExternalId: f.phoneId, providerMessageId: `wamid.in.${++msgSeq}.${randomUUID()}`,
    from, contactName: "Camila", timestamp: new Date(), type: "text", text: body, raw: {},
  });
  if (r.status !== "stored") throw new Error(`ingest: ${r.status}`);
  return r.event;
}

const q = (sql: string, params: unknown[] = []) => admin.query(sql, params).then((r) => r.rows);
let secretBox: SecretBox;

beforeAll(async () => {
  ({ admin, app: pool } = await freshDatabase());
  secretBox = new SecretBox(SecretBox.generateKey());
  deps = {
    pool, model,
    send: (req) => sendMessage({ pool, secretBox, whatsapp }, req),
  };
});

afterAll(async () => {
  await pool?.end();
  await admin?.end();
});

beforeEach(() => {
  script.length = 0;
  calls.length = 0;
  sentToMeta.length = 0;
});

// --- Tests ------------------------------------------------------------------

describe("turno básico", () => {
  it("responde, registra costo y consume los mensajes", async () => {
    const f = await seed();
    const ev = await inbound(f, "Hola, ¿cuánto cuesta el plan?");
    script.push(reply([text("¡Hola Camila! El plan Pro cuesta USD 49 al mes.")]));

    const out = await runAgentTurn(deps, ev);
    expect(out.status).toBe("replied");
    expect(sentToMeta).toEqual(["¡Hola Camila! El plan Pro cuesta USD 49 al mes."]);

    const [run] = await q("select * from agent_runs where id = $1", [out.runId]);
    const expected = usageCost("claude-opus-5-5", reply([]).usage).costUsd;
    expect(Number(run.cost_usd)).toBeCloseTo(expected, 6);
    expect(run).toMatchObject({ status: "replied", steps: 1, models_served: ["claude-opus-5-5"] });
    expect(run.reply_message_id).not.toBeNull();

    const pending = await q("select count(*)::int as n from messages where conversation_id = $1 and agent_run_id is null and direction = 'inbound'", [ev.conversationId]);
    expect(pending[0].n).toBe(0);

    // Sin mensajes nuevos no se llama al modelo.
    expect((await runAgentTurn(deps, ev)).status).toBe("nothing_to_do");
    expect(calls).toHaveLength(1);
  });

  it("la petición al modelo usa caché, fallback por defecto, esfuerzo explícito y herramientas estrictas", async () => {
    const f = await seed();
    const ev = await inbound(f, "Hola");
    script.push(reply([text("¡Hola!")]));
    await runAgentTurn(deps, ev);

    const p = calls[0]!;
    expect(p.model).toBe("claude-opus-5-5");
    expect(p.fallbacks).toBe("default");
    expect(p.betas).toEqual([FALLBACK_BETA]);
    expect(p.output_config).toEqual({ effort: "medium" });
    expect(p.cache_control).toEqual({ type: "ephemeral" });
    expect(p.thinking).toBeUndefined(); // Opus 5.5: siempre adaptativo; enviar "disabled" daría 400
    expect(p.tool_choice).toBeUndefined(); // forzar herramientas da 400 en este modelo
    const system = p.system as Anthropic.Beta.BetaTextBlockParam[];
    expect(system[0]!.text).toBe(PLATFORM_RULES);
    expect(system[1]!.cache_control).toEqual({ type: "ephemeral" });
    expect(p.tools!.map((t) => (t as Anthropic.Beta.BetaTool).name)).toEqual(["handoff_to_human", "update_lead"]);
    expect(p.tools!.every((t) => (t as Anthropic.Beta.BetaTool).strict === true)).toBe(true);
    // El primer turno incluye el contexto del cliente.
    expect(JSON.stringify(p.messages[0])).toContain("Nombre: Camila");
  });

  it("el historial se reenvía idéntico y solo crece al final (append-only)", async () => {
    const f = await seed();
    const ev = await inbound(f, "Hola");
    script.push(reply([{ type: "thinking", thinking: "", signature: "sig-1" } as Anthropic.Beta.BetaThinkingBlock, text("¡Hola!")]));
    await runAgentTurn(deps, ev);
    await inbound(f, "¿Tienen plan anual?");
    script.push(reply([text("Por ahora solo mensual.")]));
    await runAgentTurn(deps, ev);

    const [first, second] = calls;
    expect(second!.messages.slice(0, first!.messages.length)).toEqual(first!.messages);
    expect(second!.messages).toHaveLength(3);
    // El bloque de razonamiento vuelve sin cambios.
    expect(second!.messages[1]!.content).toEqual([
      { type: "thinking", thinking: "", signature: "sig-1" }, { type: "text", text: "¡Hola!", citations: null },
    ]);
  });

  it("la transcripción no se puede editar", async () => {
    const f = await seed();
    const ev = await inbound(f, "hola");
    script.push(reply([text("¡Hola!")]));
    await runAgentTurn(deps, ev);
    expect((await q("select count(*)::int as n from agent_transcripts"))[0].n).toBeGreaterThan(0);
    await expect(q("update agent_transcripts set content = '[]'")).rejects.toThrow(/append-only/);
    await expect(q("delete from agent_transcripts")).rejects.toThrow(/append-only/);
  });

  it("[SIN_RESPUESTA] no envía nada", async () => {
    const f = await seed();
    const ev = await inbound(f, "ok");
    script.push(reply([text(NO_REPLY_MARKER)]));
    expect((await runAgentTurn(deps, ev)).status).toBe("no_reply");
    expect(sentToMeta).toEqual([]);
  });
});

describe("herramientas", () => {
  it("update_lead guarda los datos y el bucle continúa hasta la respuesta", async () => {
    const f = await seed();
    const ev = await inbound(f, "Soy Camila Rojas, mi correo es camila@pyme.cl");
    script.push(reply([toolUse("update_lead", { full_name: "Camila Rojas", email: "camila@pyme.cl" })], "tool_use"));
    script.push(reply([text("¡Gracias Camila, anotado!")]));

    const out = await runAgentTurn(deps, ev);
    expect(out.status).toBe("replied");
    const [lead] = await q("select l.full_name, l.email from leads l join conversations c on c.lead_id = l.id where c.id = $1", [ev.conversationId]);
    expect(lead).toEqual({ full_name: "Camila Rojas", email: "camila@pyme.cl" });

    const rows = await q("select role, content from agent_transcripts where run_id = $1 order by id", [out.runId]);
    expect(rows.map((r) => r.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(rows[2].content[0]).toMatchObject({ type: "tool_result", content: "Datos del cliente actualizados." });
  });

  it("entrada inválida o herramienta no habilitada: error al modelo, sin romper el turno", async () => {
    const f = await seed({ tools: ["handoff_to_human"] });
    const ev = await inbound(f, "hola");
    script.push(reply([toolUse("update_lead", { full_name: "X", email: null })], "tool_use"));
    script.push(reply([toolUse("handoff_to_human", { reason: 42 })], "tool_use"));
    script.push(reply([text("¿En qué te ayudo?")]));
    expect((await runAgentTurn(deps, ev)).status).toBe("replied");
    const results = (await q("select content from agent_transcripts where conversation_id = $1 and role = 'user' order by id", [ev.conversationId])).slice(1);
    // Herramienta no habilitada y "reason" que no es texto: ambos vuelven como error al modelo.
    expect(results.map((r) => r.content[0].is_error)).toEqual([true, true]);
    const [conv] = await q("select owner from conversations where id = $1", [ev.conversationId]);
    expect(conv.owner).toBe("agent"); // una entrada inválida no provoca handoff
  });

  it("handoff: responde, pasa a humano y el agente deja de leer hasta que lo liberen", async () => {
    const f = await seed();
    const ev = await inbound(f, "Quiero hablar con una persona");
    script.push(reply([toolUse("handoff_to_human", { reason: "cliente lo pidió" })], "tool_use"));
    script.push(reply([text("Claro, te conecto con alguien del equipo.")]));

    const out = await runAgentTurn(deps, ev);
    expect(out.status).toBe("handoff");
    expect(sentToMeta).toEqual(["Claro, te conecto con alguien del equipo."]);
    const [conv] = await q("select owner from conversations where id = $1", [ev.conversationId]);
    expect(conv.owner).toBe("human");
    const audit = await q("select action, detail from audit_log where tenant_id = $1", [f.tenantId]);
    expect(audit).toEqual([{ action: "conversation.handoff", detail: { reason: "cliente lo pidió" } }]);

    // Con un humano a cargo, nuevos mensajes no llegan al modelo.
    await inbound(f, "¿Hola?");
    expect((await runAgentTurn(deps, ev)).status).toBe("skipped");
    expect(calls).toHaveLength(2);

    // El humano responde y libera; el agente recibe todo el contexto intermedio.
    await sendMessage({ pool, secretBox, whatsapp }, { tenantId: f.tenantId, conversationId: ev.conversationId, sender: "human", content: { text: "Hola Camila, soy Ana del equipo." } });
    await admin.query("update conversations set owner = 'agent' where id = $1", [ev.conversationId]);
    await inbound(f, "Gracias Ana, ya quedó claro. ¿Y el plan anual?");
    script.push(reply([text("El plan anual aún no está disponible.")]));
    expect((await runAgentTurn(deps, ev)).status).toBe("replied");
    const lastUser = JSON.stringify(calls.at(-1)!.messages.at(-1));
    expect(lastUser).toContain("Cliente: ¿Hola?");
    expect(lastUser).toContain("Equipo (persona): Hola Camila, soy Ana del equipo.");
    expect(lastUser).toContain("Cliente: Gracias Ana");
  });
});

describe("límites", () => {
  it("máximo de pasos: corta el bucle, avisa al cliente y pasa a humano", async () => {
    const f = await seed({ maxSteps: 2 });
    const ev = await inbound(f, "hola");
    script.push(reply([toolUse("update_lead", { full_name: null, email: null })], "tool_use"));
    script.push(reply([toolUse("update_lead", { full_name: null, email: null })], "tool_use"));
    const out = await runAgentTurn(deps, ev);
    expect(out.status).toBe("handoff");
    expect(calls).toHaveLength(2);
    expect(sentToMeta).toEqual([HANDOFF_NOTICE]);
  });

  it("presupuesto de la conversación agotado: no llama al modelo", async () => {
    const f = await seed({ budget: 0.001 });
    const ev = await inbound(f, "hola");
    script.push(reply([text("primera")]));
    await runAgentTurn(deps, ev); // gasta ~0,009 USD > 0,001
    await inbound(f, "¿sigues?");
    const out = await runAgentTurn(deps, ev);
    expect(out.status).toBe("budget_exceeded");
    expect(calls).toHaveLength(1);
    expect(sentToMeta.at(-1)).toBe(HANDOFF_NOTICE);
    // La respuesta anterior NO se reenvía.
    expect(sentToMeta.filter((s) => s === "primera")).toHaveLength(1);
  });

  it("presupuesto diario del tenant agotado", async () => {
    const f = await seed();
    await admin.query("update tenants set daily_llm_budget_usd = 0 where id = $1", [f.tenantId]);
    const ev = await inbound(f, "hola");
    expect((await runAgentTurn(deps, ev)).status).toBe("budget_exceeded");
    expect(calls).toHaveLength(0);
  });
});

describe("fallos y reanudación", () => {
  it("error transitorio: la actividad falla y el reintento retoma sin duplicar el turno", async () => {
    const f = await seed();
    const ev = await inbound(f, "hola");
    script.push(new Anthropic.APIConnectionError({ message: "timeout" }));
    await expect(runAgentTurn(deps, ev)).rejects.toThrow();

    script.push(reply([text("¡Hola! Perdón la demora.")]));
    const out = await runAgentTurn(deps, ev);
    expect(out.status).toBe("replied");
    const runs = await q("select count(*)::int as n from agent_runs where conversation_id = $1", [ev.conversationId]);
    const users = await q("select count(*)::int as n from agent_transcripts where conversation_id = $1 and role = 'user'", [ev.conversationId]);
    expect([runs[0].n, users[0].n]).toEqual([1, 1]);
    // Ambas llamadas recibieron exactamente el mismo historial.
    expect(calls[1]!.messages).toEqual(calls[0]!.messages);
  });

  it("error permanente (400): se cierra como fallido, avisa y pasa a humano", async () => {
    const f = await seed();
    const ev = await inbound(f, "hola");
    script.push(new Anthropic.BadRequestError(400, { type: "error", error: { type: "invalid_request_error", message: "bad" } }, "bad", new Headers()));
    const out = await runAgentTurn(deps, ev);
    expect(out.status).toBe("failed");
    expect(sentToMeta).toEqual([HANDOFF_NOTICE]);
    const [run] = await q("select status, error from agent_runs where id = $1", [out.runId]);
    expect(run.status).toBe("failed");
    expect(run.error.name).toBe("BadRequestError");
  });

  it("negativa del modelo (aun tras el fallback): no se envía su texto, avisa y pasa a humano", async () => {
    const f = await seed();
    const ev = await inbound(f, "…");
    script.push(reply([], "refusal"));
    const out = await runAgentTurn(deps, ev);
    expect(out.status).toBe("refused");
    expect(sentToMeta).toEqual([HANDOFF_NOTICE]);
  });

  it("si respondió un modelo de respaldo, el costo usa su tarifa", async () => {
    const f = await seed();
    const ev = await inbound(f, "hola");
    script.push(reply([text("ok")], "end_turn", "claude-opus-4-8"));
    const out = await runAgentTurn(deps, ev);
    const [run] = await q("select cost_usd, models_served from agent_runs where id = $1", [out.runId]);
    expect(run.models_served).toEqual(["claude-opus-4-8"]);
    expect(Number(run.cost_usd)).toBeCloseTo(usageCost("claude-opus-4-8", reply([]).usage).costUsd, 6);
  });

  it("fuera de la ventana de 24 h: no puede responder texto, pasa a humano", async () => {
    const f = await seed();
    const ev = await inbound(f, "hola");
    await admin.query("update conversations set last_inbound_at = now() - interval '25 hours' where id = $1", [ev.conversationId]);
    script.push(reply([text("¡Hola!")]));
    const out = await runAgentTurn(deps, ev);
    expect(out.status).toBe("handoff");
    expect(sentToMeta).toEqual([]);
    const [run] = await q("select handoff_reason from agent_runs where id = $1", [out.runId]);
    expect(run.handoff_reason).toMatch(/ventana/);
  });
});

describe("aislamiento", () => {
  it("con el tenant equivocado no ve la conversación", async () => {
    const a = await seed();
    const b = await seed();
    const ev = await inbound(a, "hola");
    expect((await runAgentTurn(deps, { tenantId: b.tenantId, conversationId: ev.conversationId })).status).toBe("nothing_to_do");
    expect(calls).toHaveLength(0);
  });
});
