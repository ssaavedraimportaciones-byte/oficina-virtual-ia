import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import type { ModelClient } from "@pronex/agent";
import { createOidcVerifier, SecretBox } from "@pronex/auth";
import { WhatsAppClient } from "@pronex/channels";
import { freshDatabase } from "@pronex/db/testing";
import type { FastifyInstance } from "fastify";
import { createLocalJWKSet } from "jose";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { MemoryRateLimiter } from "../src/rate-limit.js";

const TOKEN = "admin-token-de-prueba-con-mas-de-32-caracteres";
let admin: pg.Client;
let pool: pg.Pool;
let app: FastifyInstance;
let tenant: { tenantId: string; workspaceId: string; agentId: string; apiKey: string };

const model: ModelClient = {
  async create(params) {
    return {
      id: `msg_${randomUUID()}`, type: "message", role: "assistant", model: params.model,
      content: [{ type: "text", text: "¡Hola! La limpieza dental cuesta $35.000.", citations: null }],
      stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 800, output_tokens: 30, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    } as unknown as Anthropic.Beta.BetaMessage;
  },
};

const adm = (method: string, url: string, body?: object, token = TOKEN) =>
  app.inject({ method: method as "GET", url, payload: body, headers: { "x-admin-token": token } });

beforeAll(async () => {
  ({ admin, app: pool } = await freshDatabase());
  app = buildApp({
    pool,
    verifyOidc: createOidcVerifier({ issuer: "https://idp.test", audience: "pronex-api", jwks: createLocalJWKSet({ keys: [] }) }),
    rateLimiter: new MemoryRateLimiter(),
    agentModel: model,
    adminToken: TOKEN,
    channels: {
      secretBox: new SecretBox(SecretBox.generateKey()),
      dispatcher: { dispatch: async () => {} },
      whatsapp: { client: new WhatsAppClient(), appSecret: "s", verifyToken: "v" },
    },
  });
  await app.ready();
});

afterAll(async () => {
  await app?.close();
  await pool?.end();
  await admin?.end();
});

describe("administración del operador", () => {
  it("sin token o con token incorrecto → 401", async () => {
    expect((await app.inject({ method: "POST", url: "/admin/tenants", payload: { name: "x" } })).statusCode).toBe(401);
    expect((await adm("POST", "/admin/tenants", { name: "x" }, "otro-token")).statusCode).toBe(401);
    expect((await adm("POST", "/admin/tenants", { name: "x" }, TOKEN + "x")).statusCode).toBe(401);
  });

  it("crea una empresa con agente de ejemplo publicado y una API key de owner que funciona", async () => {
    const res = await adm("POST", "/admin/tenants", { name: "Clínica Real", demoAgent: true });
    expect(res.statusCode).toBe(201);
    tenant = res.json();
    expect(tenant.apiKey).toMatch(/^pnx_live_/);
    expect(res.json().apiKeyScopes).not.toContain("api_keys:manage");

    const agents = await app.inject({ url: "/v1/agents", headers: { authorization: `Bearer ${tenant.apiKey}` } });
    expect(agents.json().data).toHaveLength(1);
    expect(agents.json().data[0].published_version_id).not.toBeNull();
    const cases = await app.inject({ url: `/v1/agents/${tenant.agentId}/golden-cases`, headers: { authorization: `Bearer ${tenant.apiKey}` } });
    expect(cases.json().data).toHaveLength(3);
  });

  it("conecta un número de WhatsApp con el token cifrado y asignado al agente", async () => {
    const res = await adm("POST", `/admin/tenants/${tenant.tenantId}/channels/whatsapp`, {
      phoneNumberId: "123456789012", accessToken: "EAAG-token-real-de-meta-xxxxxxxx", agentId: tenant.agentId,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ external_id: "123456789012", agent_id: tenant.agentId });
    const { rows } = await admin.query("select credentials_enc from channel_accounts where external_id = '123456789012'");
    expect(rows[0].credentials_enc).not.toContain("EAAG");
    // El mismo número dos veces → 409.
    const dup = await adm("POST", `/admin/tenants/${tenant.tenantId}/channels/whatsapp`, { phoneNumberId: "123456789012", accessToken: "EAAG-otro-token-xxxxxxxxxxxx" });
    expect(dup.statusCode).toBe(409);
  });

  it("empresa inexistente → 404; queda auditado lo que sí se hizo", async () => {
    const res = await adm("POST", `/admin/tenants/${randomUUID()}/channels/whatsapp`, { phoneNumberId: "999999", accessToken: "EAAG-xxxxxxxxxxxxxxxxxxxxxx" });
    expect(res.statusCode).toBe(404);
    const { rows } = await admin.query("select actor, action from audit_log where tenant_id = $1 order by id", [tenant.tenantId]);
    expect(rows).toEqual([
      { actor: "platform_admin", action: "tenant.create" },
      { actor: "platform_admin", action: "channel.connect" },
    ]);
  });

  it("limita los intentos por IP", async () => {
    const limited = buildApp({
      pool, rateLimiter: new MemoryRateLimiter(), adminToken: TOKEN,
      verifyOidc: createOidcVerifier({ issuer: "x", audience: "y", jwks: createLocalJWKSet({ keys: [] }) }),
    });
    const codes: number[] = [];
    for (let i = 0; i < 32; i++) {
      codes.push((await limited.inject({ method: "POST", url: "/admin/tenants", payload: { name: "x" }, headers: { "x-admin-token": "adivinando" } })).statusCode);
    }
    expect(codes.slice(0, 30).every((c) => c === 401)).toBe(true);
    expect(codes.slice(30)).toEqual([429, 429]);
    await limited.close();
  });

  it("sin PRONEX_ADMIN_TOKEN las rutas no existen; un token corto se rechaza al arrancar", async () => {
    const without = buildApp({ pool, rateLimiter: new MemoryRateLimiter(), verifyOidc: createOidcVerifier({ issuer: "x", audience: "y", jwks: createLocalJWKSet({ keys: [] }) }) });
    expect((await without.inject({ method: "POST", url: "/admin/tenants", payload: { name: "x" } })).statusCode).toBe(404);
    await without.close();
    expect(() => buildApp({ pool, rateLimiter: new MemoryRateLimiter(), adminToken: "corto", verifyOidc: createOidcVerifier({ issuer: "x", audience: "y", jwks: createLocalJWKSet({ keys: [] }) }) }))
      .toThrow(/32 caracteres/);
  });
});

describe("probar el agente sin WhatsApp", () => {
  it("devuelve lo que respondería, sin ensuciar la bandeja", async () => {
    const versions = await app.inject({ url: `/v1/agents/${tenant.agentId}/versions`, headers: { authorization: `Bearer ${tenant.apiKey}` } });
    const versionId = versions.json().data[0].id;
    const res = await app.inject({
      method: "POST", url: `/v1/agents/${tenant.agentId}/versions/${versionId}/try`,
      headers: { authorization: `Bearer ${tenant.apiKey}` }, payload: { messages: ["Hola, ¿cuánto cuesta la limpieza?"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ replies: ["¡Hola! La limpieza dental cuesta $35.000."], statuses: ["replied"], handoff: false });
    expect(res.json().costUsd).toBeGreaterThan(0);
    const inbox = await app.inject({ url: "/v1/conversations", headers: { authorization: `Bearer ${tenant.apiKey}` } });
    expect(inbox.json().data).toEqual([]);
  });
});
