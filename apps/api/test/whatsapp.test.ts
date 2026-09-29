import { createHmac } from "node:crypto";
import { createOidcVerifier, SecretBox } from "@pronex/auth";
import { WhatsAppClient } from "@pronex/channels";
import { freshDatabase } from "@pronex/db/testing";
import type { FastifyInstance } from "fastify";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { sendMessage, sweepPendingInbound, type InboundEvent } from "@pronex/messaging";
import { MemoryRateLimiter } from "../src/rate-limit.js";

const APP_SECRET = "meta-app-secret";
const VERIFY_TOKEN = "verify-me";
const PHONE_ID = "100200300";
const ACCESS_TOKEN = "EAAG-super-secret-access-token";

let admin: pg.Client;
let pool: pg.Pool;
let app: FastifyInstance;
let secretBox: SecretBox;
let whatsappClient: WhatsAppClient;

// Dispatcher y Graph API falsos, controlables desde cada test.
const dispatched: InboundEvent[] = [];
let dispatcherDown = false;
const graphCalls: { url: string; auth: string; body: Record<string, unknown> }[] = [];
let graphResponse: { status: number; body: object } = { status: 200, body: { messages: [{ id: "wamid.OUT.1" }] } };

const ana = { token: "", tenantId: "", workspaceId: "" };
const bob = { token: "", tenantId: "", workspaceId: "" };
let conversationId = "";

function payload(value: object) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "WABA", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp", metadata: { display_phone_number: "56912345678", phone_number_id: PHONE_ID }, ...value,
    } }] }],
  };
}
const textMsg = (id: string, from = "56987654321", body = "Hola, ¿precio del plan?", name = "Camila") =>
  payload({
    contacts: [{ wa_id: from, profile: { name } }],
    messages: [{ from, id, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body } }],
  });

function webhook(body: object | string, signature?: string) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return app.inject({
    method: "POST", url: "/webhooks/whatsapp", payload: raw,
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": signature ?? `sha256=${createHmac("sha256", APP_SECRET).update(raw).digest("hex")}`,
    },
  });
}
const api = (method: string, url: string, token: string, body?: object) =>
  app.inject({ method: method as "GET", url, payload: body, headers: { authorization: `Bearer ${token}` } });

beforeAll(async () => {
  ({ admin, app: pool } = await freshDatabase());
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
  const sign = (sub: string) => new SignJWT({}).setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer("https://idp.test").setAudience("pronex-api").setSubject(sub).setExpirationTime("5m").sign(privateKey);

  secretBox = new SecretBox(SecretBox.generateKey());
  whatsappClient = new WhatsAppClient({
    fetch: (async (url: string, init: RequestInit) => {
      graphCalls.push({ url, auth: (init.headers as Record<string, string>).authorization!, body: JSON.parse(init.body as string) });
      return new Response(JSON.stringify(graphResponse.body), { status: graphResponse.status });
    }) as unknown as typeof fetch,
  });

  app = buildApp({
    pool,
    verifyOidc: createOidcVerifier({ issuer: "https://idp.test", audience: "pronex-api", jwks: createLocalJWKSet({ keys: [jwk] }) }),
    rateLimiter: new MemoryRateLimiter(),
    channels: {
      secretBox,
      dispatcher: {
        async dispatch(e) {
          if (dispatcherDown) throw new Error("temporal caído");
          dispatched.push(e);
        },
      },
      whatsapp: { client: whatsappClient, appSecret: APP_SECRET, verifyToken: VERIFY_TOKEN },
    },
  });
  await app.ready();

  for (const [who, sub] of [[ana, "ana"], [bob, "bob"]] as const) {
    who.token = await sign(sub);
    Object.assign(who, (await api("POST", "/v1/tenants", who.token, { name: sub })).json());
  }
});

afterAll(async () => {
  await app?.close();
  await pool?.end();
  await admin?.end();
});

describe("suscripción del webhook (handshake de Meta)", () => {
  it("devuelve el challenge con el verify token correcto", async () => {
    const res = await app.inject({ url: `/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=12345` });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("12345");
  });

  it("403 con token incorrecto", async () => {
    const res = await app.inject({ url: "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=1" });
    expect(res.statusCode).toBe(403);
  });
});

describe("firma del webhook", () => {
  it("rechaza sin firma, con firma falsa o firmada con otro secreto", async () => {
    const body = JSON.stringify(textMsg("wamid.X"));
    expect((await webhook(body, "")).statusCode).toBe(401);
    expect((await webhook(body, "sha256=deadbeef")).statusCode).toBe(401);
    expect((await webhook(body, `sha256=${createHmac("sha256", "otro").update(body).digest("hex")}`)).statusCode).toBe(401);
    const { rows } = await admin.query("select count(*)::int as n from messages");
    expect(rows[0].n).toBe(0);
  });

  it("firma válida con JSON roto → 400", async () => {
    expect((await webhook("{no-json")).statusCode).toBe(400);
  });
});

describe("conexión del número", () => {
  it("owner conecta su número; el token queda cifrado", async () => {
    const res = await api("POST", "/v1/channels/whatsapp", ana.token, {
      workspaceId: ana.workspaceId, phoneNumberId: PHONE_ID, accessToken: ACCESS_TOKEN, displayName: "Ventas",
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.stringify(res.json())).not.toContain(ACCESS_TOKEN);
    const { rows } = await admin.query("select credentials_enc from channel_accounts");
    expect(rows[0].credentials_enc).not.toContain(ACCESS_TOKEN);
    expect(rows[0].credentials_enc).toMatch(/^v1\./);
  });

  it("otro tenant no puede conectar el mismo número", async () => {
    const res = await api("POST", "/v1/channels/whatsapp", bob.token, {
      workspaceId: bob.workspaceId, phoneNumberId: PHONE_ID, accessToken: "EAAG-bob-token-xxxxxxxxxx",
    });
    expect(res.statusCode).toBe(409);
  });

  it("una API key no puede conectar canales", async () => {
    const key = (await api("POST", "/v1/api-keys", ana.token, { name: "k", scopes: ["conversations:read"] })).json().token;
    const res = await api("POST", "/v1/channels/whatsapp", key, {
      workspaceId: ana.workspaceId, phoneNumberId: "999999", accessToken: "EAAG-xxxxxxxxxxxxxxxxxxxx",
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("mensajes entrantes", () => {
  it("un mensaje crea lead, conversación y mensaje, y se despacha al agente", async () => {
    const res = await webhook(textMsg("wamid.IN.1"));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ stored: 1, duplicate: 0 });

    const convs = (await api("GET", "/v1/conversations", ana.token)).json().data;
    expect(convs).toHaveLength(1);
    expect(convs[0]).toMatchObject({ lead_name: "Camila", lead_phone: "+56987654321", owner: "agent", channel: "whatsapp" });
    conversationId = convs[0].id;

    expect(dispatched).toEqual([{ tenantId: ana.tenantId, conversationId, messageId: expect.any(String) }]);
    const { rows } = await admin.query("select dispatched_at from messages where provider_msg_id = 'wamid.IN.1'");
    expect(rows[0].dispatched_at).not.toBeNull();
  });

  it("el mismo webhook reenviado no duplica ni vuelve a disparar al agente", async () => {
    const res = await webhook(textMsg("wamid.IN.1"));
    expect(res.json()).toMatchObject({ stored: 0, duplicate: 1 });
    expect(dispatched).toHaveLength(1);
    const { rows } = await admin.query("select count(*)::int as n from messages where provider_msg_id = 'wamid.IN.1'");
    expect(rows[0].n).toBe(1);
  });

  it("ráfaga concurrente de un número nuevo: 1 lead, 1 conversación, N mensajes", async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => webhook(textMsg(`wamid.BURST.${i}`, "56911112222", `msg ${i}`, "Pedro"))),
    );
    expect(results.every((r) => r.statusCode === 200)).toBe(true);
    const { rows } = await admin.query(`
      select (select count(*)::int from leads where phone = '+56911112222') as leads,
             (select count(*)::int from conversations c join leads l on l.id = c.lead_id where l.phone = '+56911112222') as convs,
             (select count(*)::int from messages where provider_msg_id like 'wamid.BURST.%') as msgs`);
    expect(rows[0]).toEqual({ leads: 1, convs: 1, msgs: 6 });
  });

  it("número no conectado: se responde 200 (para que Meta no reintente) y no se guarda nada", async () => {
    const other = textMsg("wamid.OTHER");
    other.entry[0]!.changes[0]!.value.metadata.phone_number_id = "555";
    const res = await webhook(other);
    expect(res.statusCode).toBe(200);
    expect(res.json().unknown_account).toBe(1);
    const { rows } = await admin.query("select count(*)::int as n from messages where provider_msg_id = 'wamid.OTHER'");
    expect(rows[0].n).toBe(0);
  });

  it("otro tenant no ve la conversación ni sus mensajes", async () => {
    expect((await api("GET", "/v1/conversations", bob.token)).json().data).toEqual([]);
    expect((await api("GET", `/v1/conversations/${conversationId}/messages`, bob.token)).json().data).toEqual([]);
    expect((await api("POST", `/v1/conversations/${conversationId}/messages`, bob.token, { text: "hola" })).statusCode).toBe(404);
  });
});

describe("respuestas y handoff", () => {
  it("un humano responde: se envía a Meta con el token descifrado y toma la conversación", async () => {
    graphCalls.length = 0;
    const res = await api("POST", `/v1/conversations/${conversationId}/messages`, ana.token, { text: "¡Hola Camila! El plan cuesta $49." });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ status: "sent", sender: "human", provider_msg_id: "wamid.OUT.1" });

    expect(graphCalls).toHaveLength(1);
    expect(graphCalls[0]!.url).toContain(`/${PHONE_ID}/messages`);
    expect(graphCalls[0]!.auth).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(graphCalls[0]!.body).toMatchObject({ to: "56987654321", text: { body: "¡Hola Camila! El plan cuesta $49." } });

    const conv = (await api("GET", "/v1/conversations", ana.token)).json().data.find((c: { id: string }) => c.id === conversationId);
    expect(conv.owner).toBe("human");
  });

  it("con un humano a cargo, el agente no puede responder; al liberar, sí", async () => {
    const deps = { pool, secretBox, whatsapp: whatsappClient };
    const req = { tenantId: ana.tenantId, conversationId, sender: "agent" as const, content: { text: "respuesta IA" } };
    await expect(sendMessage(deps, req)).rejects.toMatchObject({ status: 409, code: "human_owns_conversation" });

    expect((await api("POST", `/v1/conversations/${conversationId}/release`, ana.token)).statusCode).toBe(204);
    graphResponse = { status: 200, body: { messages: [{ id: "wamid.OUT.2" }] } };
    await expect(sendMessage(deps, req)).resolves.toMatchObject({ sender: "agent", status: "sent" });
  });

  it("los estados de entrega avanzan y nunca retroceden", async () => {
    const status = (s: string) => payload({ statuses: [{ id: "wamid.OUT.1", status: s, timestamp: "1", recipient_id: "569" }] });
    await webhook(status("delivered"));
    await webhook(status("read"));
    await webhook(status("delivered")); // llega tarde y desordenado
    const { rows } = await admin.query("select status from messages where provider_msg_id = 'wamid.OUT.1'");
    expect(rows[0].status).toBe("read");
  });

  it("fuera de la ventana de 24 h solo se permiten plantillas", async () => {
    await admin.query("update conversations set last_inbound_at = now() - interval '25 hours' where id = $1", [conversationId]);
    const text = await api("POST", `/v1/conversations/${conversationId}/messages`, ana.token, { text: "¿Seguimos?" });
    expect(text.statusCode).toBe(409);
    expect(text.json().error).toBe("outside_service_window");

    graphResponse = { status: 200, body: { messages: [{ id: "wamid.TPL" }] } };
    const tpl = await api("POST", `/v1/conversations/${conversationId}/messages`, ana.token, { template: { name: "recontacto", language: "es" } });
    expect(tpl.statusCode).toBe(201);
    expect(graphCalls.at(-1)!.body).toMatchObject({ type: "template", template: { name: "recontacto" } });
  });

  it("si Meta falla, el mensaje queda como 'failed' y la API responde 502", async () => {
    await admin.query("update conversations set last_inbound_at = now() where id = $1", [conversationId]);
    graphResponse = { status: 500, body: { error: { code: 1, message: "Internal" } } };
    const res = await api("POST", `/v1/conversations/${conversationId}/messages`, ana.token, { text: "hola" });
    expect(res.statusCode).toBe(502);
    const { rows } = await admin.query("select status, error->>'status' as http from messages where body = 'hola' and direction = 'outbound'");
    expect(rows[0]).toEqual({ status: "failed", http: "500" });
    graphResponse = { status: 200, body: { messages: [{ id: "wamid.OUT.3" }] } };
  });

  it("body inválido: ni texto ni plantilla → 400", async () => {
    expect((await api("POST", `/v1/conversations/${conversationId}/messages`, ana.token, {})).statusCode).toBe(400);
  });
});

describe("outbox: si el runtime del agente está caído no se pierde nada", () => {
  it("el mensaje queda pendiente y el barrido lo despacha cuando vuelve", async () => {
    dispatcherDown = true;
    const before = dispatched.length;
    expect((await webhook(textMsg("wamid.LOST"))).json().stored).toBe(1);
    expect(dispatched).toHaveLength(before);

    dispatcherDown = false;
    const r = await sweepPendingInbound(pool, { dispatch: async (e) => { dispatched.push(e); } }, 0);
    expect(r).toEqual({ pending: 1, dispatched: 1 });
    expect(dispatched).toHaveLength(before + 1);
    // Un segundo barrido no re-despacha.
    expect(await sweepPendingInbound(pool, { dispatch: async () => {} }, 0)).toEqual({ pending: 0, dispatched: 0 });
  });
});

describe("auditoría", () => {
  it("registra conexión de canal y liberación de conversación", async () => {
    const { rows } = await admin.query("select action from audit_log where tenant_id = $1 order by id", [ana.tenantId]);
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(["channel.connect", "conversation.release"]));
  });
});
