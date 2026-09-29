import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import Anthropic from "@anthropic-ai/sdk";
import { HANDOFF_NOTICE, type CreateParams, type ModelClient } from "@pronex/agent";
import { SecretBox } from "@pronex/auth";
import { WhatsAppClient } from "@pronex/channels";
import { withTenant } from "@pronex/db";
import { freshDatabase } from "@pronex/db/testing";
import { credentialsAad, dispatchInbound, ingestInbound, sendMessage, type InboundEvent } from "@pronex/messaging";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Runtime, DefaultLogger, Worker } from "@temporalio/worker";
import type pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as activities from "../src/activities.js";
import { temporalDispatcher } from "../src/dispatcher.js";
import { TASK_QUEUE, workflowIdFor } from "../src/names.js";

let admin: pg.Client;
let pool: pg.Pool;
let env: TestWorkflowEnvironment;
let worker: Worker;
let workerRun: Promise<void>;
let secretBox: SecretBox;

// Modelo guionado con latencia configurable, para observar concurrencia.
type Step = { content?: string; error?: Error; delayMs?: number };
let script: Step[] = [];
let defaultStep: Step | null = null;
const calls: { params: CreateParams; startedAt: number; endedAt: number }[] = [];
let inFlight = 0;
let maxInFlight = 0;

const model: ModelClient = {
  async create(params) {
    const step = script.shift() ?? defaultStep;
    if (!step) throw new Error("guion agotado");
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    const startedAt = Date.now();
    try {
      await new Promise((r) => setTimeout(r, step.delayMs ?? 0));
      if (step.error) throw step.error;
      return {
        id: `msg_${randomUUID()}`, type: "message", role: "assistant", model: "claude-opus-5-5",
        content: [{ type: "text", text: step.content ?? "ok", citations: null }],
        stop_reason: "end_turn", stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      } as unknown as Anthropic.Beta.BetaMessage;
    } finally {
      inFlight--;
      calls.push({ params: structuredClone(params), startedAt, endedAt: Date.now() });
    }
  },
};

const sent: string[] = [];
const whatsapp = new WhatsAppClient({
  fetch: (async (_u: string, init: RequestInit) => {
    sent.push(JSON.parse(init.body as string).text?.body);
    return new Response(JSON.stringify({ messages: [{ id: `wamid.${randomUUID()}` }] }), { status: 200 });
  }) as unknown as typeof fetch,
});

async function seed() {
  const tenantId = randomUUID();
  const phoneId = String(Math.floor(Math.random() * 1e12));
  await withTenant(pool, tenantId, async (c) => {
    await c.query("insert into tenants (id, name) values ($1, 'PyME')", [tenantId]);
    const ws = (await c.query("insert into workspaces (tenant_id, name) values ($1, 'main') returning id", [tenantId])).rows[0].id;
    const agent = (await c.query("insert into agents (tenant_id, workspace_id, name) values ($1, $2, 'Ventas') returning id", [tenantId, ws])).rows[0].id;
    await c.query(
      `insert into agent_versions (tenant_id, agent_id, version, prompt, model, tools) values ($1, $2, 1, 'Vendes planes.', 'claude-opus-5-5', '[]')`,
      [tenantId, agent],
    );
    await c.query(
      `insert into channel_accounts (tenant_id, workspace_id, channel, external_id, credentials_enc, agent_id)
       values ($1, $2, 'whatsapp', $3, $4, $5)`,
      [tenantId, ws, phoneId, secretBox.seal("EAAG-token", credentialsAad(tenantId)), agent],
    );
  });
  return { tenantId, phoneId };
}

// El camino real de producción: webhook → ingest → dispatcher de Temporal.
async function incoming(f: { phoneId: string }, text: string, opts: Parameters<typeof temporalDispatcher>[1] = {}): Promise<InboundEvent> {
  const r = await ingestInbound(pool, {
    channel: "whatsapp", accountExternalId: f.phoneId, providerMessageId: `wamid.${randomUUID()}`,
    from: "+56911112222", contactName: "Pedro", timestamp: new Date(), type: "text", text, raw: {},
  });
  if (r.status !== "stored") throw new Error(r.status);
  const ok = await dispatchInbound(pool, temporalDispatcher(env.client, { debounceMs: 400, maxDebounceMs: 4_000, maxAttempts: 3, ...opts }), r.event);
  if (!ok) throw new Error("dispatch falló");
  return r.event;
}

async function waitFor<T>(fn: () => Promise<T | undefined | false>, timeoutMs = 20_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > until) throw new Error("timeout esperando condición");
    await new Promise((r) => setTimeout(r, 100));
  }
}

const runs = (conversationId: string) =>
  admin.query("select status, error from agent_runs where conversation_id = $1 order by started_at", [conversationId]).then((r) => r.rows);

beforeAll(async () => {
  ({ admin, app: pool } = await freshDatabase());
  secretBox = new SecretBox(SecretBox.generateKey());
  Runtime.install({ logger: new DefaultLogger("WARN") });

  env = await TestWorkflowEnvironment.createLocal(
    process.env.TEMPORAL_CLI_PATH ? { server: { executable: { type: "existing-path", path: process.env.TEMPORAL_CLI_PATH } } } : {},
  );
  activities.configureActivities({ pool, model, send: (req) => sendMessage({ pool, secretBox, whatsapp }, req) });
  worker = await Worker.create({
    connection: env.nativeConnection,
    taskQueue: TASK_QUEUE,
    workflowsPath: createRequire(import.meta.url).resolve("../src/workflows.ts"),
    activities,
    bundlerOptions: {
      // Los imports usan ".js" (ESM de TypeScript); en el bundle apuntan a los .ts.
      webpackConfigHook: (config) => ({
        ...config,
        resolve: { ...config.resolve, extensionAlias: { ".js": [".ts", ".js"] } },
      }),
    },
  });
  workerRun = worker.run();
}, 120_000);

afterAll(async () => {
  worker?.shutdown();
  await workerRun;
  await env?.teardown();
  await pool?.end();
  await admin?.end();
}, 60_000);

beforeEach(() => {
  script = [];
  defaultStep = null;
  calls.length = 0;
  sent.length = 0;
  inFlight = 0;
  maxInFlight = 0;
});

describe("workflow por conversación (Temporal real)", () => {
  it("un mensaje → una respuesta por WhatsApp", async () => {
    const f = await seed();
    script.push({ content: "¡Hola Pedro!" });
    const ev = await incoming(f, "Hola");
    await waitFor(async () => sent.length === 1);
    expect(sent).toEqual(["¡Hola Pedro!"]);
    expect(await runs(ev.conversationId)).toEqual([{ status: "replied", error: null }]);
  });

  it("ráfaga de mensajes: se agrupan en un solo turno y una sola respuesta", async () => {
    const f = await seed();
    script.push({ content: "Te cuento de los planes…" });
    // Mensajes separados 250 ms (menos que la ventana de 400 ms): sin agrupar, el primero se respondería solo.
    const pause = () => new Promise((r) => setTimeout(r, 250));
    const ev = await incoming(f, "Hola");
    await pause();
    await incoming(f, "quería saber");
    await pause();
    await incoming(f, "los precios");
    await waitFor(async () => sent.length === 1);
    await new Promise((r) => setTimeout(r, 1_500)); // margen: no debe haber una segunda respuesta
    expect(calls).toHaveLength(1);
    const lastUser = JSON.stringify(calls[0]!.params.messages.at(-1));
    expect(lastUser).toContain("Hola\\nquería saber\\nlos precios");
    expect(await runs(ev.conversationId)).toHaveLength(1);
  });

  it("un mensaje que llega mientras el agente piensa espera su turno (nunca en paralelo)", async () => {
    const f = await seed();
    script.push({ content: "primera", delayMs: 2_000 }, { content: "segunda" });
    const ev = await incoming(f, "uno");
    await waitFor(async () => inFlight === 1); // el modelo está "pensando"
    await incoming(f, "dos");
    await waitFor(async () => sent.length === 2);
    expect(maxInFlight).toBe(1);
    expect(calls[1]!.startedAt).toBeGreaterThanOrEqual(calls[0]!.endedAt);
    expect(sent).toEqual(["primera", "segunda"]);
    expect((await runs(ev.conversationId)).map((r) => r.status)).toEqual(["replied", "replied"]);
  });

  it("error transitorio del modelo: Temporal reintenta y responde una sola vez", async () => {
    const f = await seed();
    script.push({ error: new Anthropic.APIConnectionError({ message: "timeout" }) }, { content: "¡Listo!" });
    const ev = await incoming(f, "hola");
    await waitFor(async () => sent.length === 1, 30_000);
    expect(sent).toEqual(["¡Listo!"]);
    expect(calls).toHaveLength(2);
    expect(await runs(ev.conversationId)).toEqual([{ status: "replied", error: null }]);
  });

  it("reintentos agotados: aviso al cliente y la conversación pasa a un humano", async () => {
    const f = await seed();
    defaultStep = { error: new Anthropic.InternalServerError(529, { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }, "Overloaded", new Headers()) };
    const ev = await incoming(f, "hola", { maxAttempts: 2 });
    await waitFor(async () => sent.length === 1, 40_000);
    expect(sent).toEqual([HANDOFF_NOTICE]);
    const [run] = await runs(ev.conversationId);
    expect(run.status).toBe("failed");
    expect(run.error.message).toMatch(/Overloaded/);
    const { rows: [conv] } = await admin.query("select owner from conversations where id = $1", [ev.conversationId]);
    expect(conv.owner).toBe("human");
  });

  it("webhooks duplicados no crean un segundo workflow ni una segunda respuesta", async () => {
    const f = await seed();
    script.push({ content: "una vez" });
    const ev = await incoming(f, "hola");
    // Re-despacho del mismo evento (p. ej., el barrido del outbox) → misma conversación, mismo workflow.
    await temporalDispatcher(env.client, { debounceMs: 400 }).dispatch(ev);
    await waitFor(async () => sent.length === 1);
    await new Promise((r) => setTimeout(r, 1_500));
    expect(sent).toEqual(["una vez"]);
    const desc = await env.client.workflow.getHandle(workflowIdFor(ev.conversationId)).describe();
    expect(desc.status.name).toBe("RUNNING"); // sigue vivo esperando el próximo mensaje
  });
});
