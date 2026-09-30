import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import type { ModelClient } from "@pronex/agent";
import { createOidcVerifier } from "@pronex/auth";
import { freshDatabase } from "@pronex/db/testing";
import type { FastifyInstance } from "fastify";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { MemoryRateLimiter } from "../src/rate-limit.js";

let admin: pg.Client;
let pool: pg.Pool;
let app: FastifyInstance;
let sign: (sub: string) => Promise<string>;
let verifyOidc: ReturnType<typeof createOidcVerifier>;

// El "modelo" responde lo que el test le indique; por defecto repite el precio del prompt.
let answer = "El plan Pro cuesta USD 49 al mes.";
const model: ModelClient = {
  async create(params) {
    return {
      id: `msg_${randomUUID()}`, type: "message", role: "assistant", model: params.model,
      content: [{ type: "text", text: answer, citations: null }], stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 500, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    } as unknown as Anthropic.Beta.BetaMessage;
  },
};

const owner = { token: "", tenantId: "", workspaceId: "" };
let agentId = "";
const versions: string[] = [];

const api = (method: string, url: string, token: string, body?: object) =>
  app.inject({ method: method as "GET", url, payload: body, headers: { authorization: `Bearer ${token}` } });

beforeAll(async () => {
  ({ admin, app: pool } = await freshDatabase());
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
  sign = (sub) => new SignJWT({}).setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer("https://idp.test").setAudience("pronex-api").setSubject(sub).setExpirationTime("5m").sign(privateKey);
  verifyOidc = createOidcVerifier({ issuer: "https://idp.test", audience: "pronex-api", jwks: createLocalJWKSet({ keys: [jwk] }) });
  app = buildApp({
    pool,
    verifyOidc,
    rateLimiter: new MemoryRateLimiter(),
    agentModel: model,
  });
  await app.ready();
  owner.token = await sign("owner");
  Object.assign(owner, (await api("POST", "/v1/tenants", owner.token, { name: "Clínica" })).json());
});

afterAll(async () => {
  await app?.close();
  await pool?.end();
  await admin?.end();
});

describe("agentes y versiones", () => {
  it("crear un agente crea la versión 1, sin publicar", async () => {
    const res = await api("POST", "/v1/agents", owner.token, {
      workspaceId: owner.workspaceId, name: "Ventas", prompt: "Vendes el plan Pro a USD 49/mes.",
    });
    expect(res.statusCode).toBe(201);
    agentId = res.json().id;
    versions.push(res.json().versions[0].id);
    expect(res.json().versions[0]).toMatchObject({ version: 1, model: "claude-opus-5-5", effort: "medium", tools: ["handoff_to_human", "update_lead"] });
    const list = (await api("GET", "/v1/agents", owner.token)).json().data;
    expect(list[0]).toMatchObject({ id: agentId, published_version_id: null, latest_version: 1 });
  });

  it("una versión nueva hereda de la anterior y reporta qué cambió", async () => {
    const res = await api("POST", `/v1/agents/${agentId}/versions`, owner.token, { prompt: "Vendes el plan Pro a USD 49/mes. Sé breve.", notes: "más corto" });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ version: 2, changed: ["prompt"], model: "claude-opus-5-5" });
    versions.push(res.json().id);
    // Sin cambios reales → 409.
    expect((await api("POST", `/v1/agents/${agentId}/versions`, owner.token, { notes: "nada" })).statusCode).toBe(409);
    // Herramienta inexistente → 400.
    expect((await api("POST", `/v1/agents/${agentId}/versions`, owner.token, { tools: ["borrar_todo"] })).statusCode).toBe(400);
  });

  it("las versiones son inmutables en la base de datos", async () => {
    await expect(admin.query("update agent_versions set prompt = 'hackeado'")).rejects.toThrow(/inmutable/);
  });
});

describe("publicación con conversaciones doradas", () => {
  it("sin casos dorados se puede publicar directamente", async () => {
    const res = await api("POST", `/v1/agents/${agentId}/publish`, owner.token, { versionId: versions[0] });
    expect(res.statusCode).toBe(200);
    expect(res.json().published_version_id).toBe(versions[0]);
  });

  it("con casos dorados, publicar exige una evaluación aprobada", async () => {
    const gc = await api("POST", `/v1/agents/${agentId}/golden-cases`, owner.token, {
      name: "precio del plan", turns: ["¿Cuánto cuesta el plan Pro?"],
      expectations: { must_contain: ["USD 49"], must_not_contain: ["gratis"], expect_handoff: false, max_cost_usd: 0.05 },
    });
    expect(gc.statusCode).toBe(201);
    const res = await api("POST", `/v1/agents/${agentId}/publish`, owner.token, { versionId: versions[1] });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("evaluation_required");
  });

  it("una evaluación fallida bloquea la publicación y explica por qué", async () => {
    answer = "¡El plan Pro es gratis este mes!";
    const ev = await api("POST", `/v1/agents/${agentId}/versions/${versions[1]}/evaluate`, owner.token);
    expect(ev.statusCode).toBe(200);
    expect(ev.json()).toMatchObject({ status: "failed", total: 1, passed: 0 });
    expect(ev.json().results[0].failures).toEqual(['falta "USD 49"', 'no debía decir "gratis"']);

    const pub = await api("POST", `/v1/agents/${agentId}/publish`, owner.token, { versionId: versions[1] });
    expect(pub.json().error).toBe("golden_cases_failed");
  });

  it("el guardrail también corre en la evaluación: un precio inventado hace fallar el caso", async () => {
    answer = "El plan Pro cuesta USD 19 al mes.";
    const ev = (await api("POST", `/v1/agents/${agentId}/versions/${versions[1]}/evaluate`, owner.token)).json();
    expect(ev.status).toBe("failed");
    expect(ev.results[0].handoff).toBe(true);
    expect(ev.results[0].failures).toContain("pasó a una persona sin que correspondiera");
  });

  it("con la evaluación aprobada se publica", async () => {
    answer = "El plan Pro cuesta USD 49 al mes.";
    const ev = (await api("POST", `/v1/agents/${agentId}/versions/${versions[1]}/evaluate`, owner.token)).json();
    expect(ev).toMatchObject({ status: "passed", total: 1, passed: 1 });
    expect(ev.costUsd).toBeGreaterThan(0);
    const pub = await api("POST", `/v1/agents/${agentId}/publish`, owner.token, { versionId: versions[1] });
    expect(pub.json().published_version_id).toBe(versions[1]);
  });

  it("las conversaciones de evaluación no aparecen en la bandeja", async () => {
    expect((await api("GET", "/v1/conversations", owner.token)).json().data).toEqual([]);
    const { rows } = await admin.query("select count(*)::int as n from conversations where is_sandbox");
    expect(rows[0].n).toBe(3); // una por cada evaluación corrida
  });

  it("forzar sin evaluación solo lo puede el owner, y queda auditado", async () => {
    const v3 = (await api("POST", `/v1/agents/${agentId}/versions`, owner.token, { effort: "high" })).json().id;
    versions.push(v3);

    const builderToken = await sign("builder");
    await api("GET", "/v1/me", builderToken);
    await admin.query(
      "insert into memberships (tenant_id, user_id, role) select $1, id, 'builder' from users where subject = 'builder'", [owner.tenantId],
    );
    const byBuilder = await api("POST", `/v1/agents/${agentId}/publish`, builderToken, { versionId: v3, force: true });
    expect(byBuilder.statusCode).toBe(403);

    const byOwner = await api("POST", `/v1/agents/${agentId}/publish`, owner.token, { versionId: v3, canaryPercent: 20, force: true });
    expect(byOwner.json()).toMatchObject({ published_version_id: versions[1], canary_version_id: v3, canary_percent: 20 });
    const { rows } = await admin.query("select detail from audit_log where action = 'agent.canary'");
    expect(rows[0].detail).toMatchObject({ forced: true, canaryPercent: 20 });
  });

  it("rollback: vuelve a una versión anterior de inmediato y cancela la canary", async () => {
    const res = await api("POST", `/v1/agents/${agentId}/rollback`, owner.token, { versionId: versions[0] });
    expect(res.json()).toMatchObject({ published_version_id: versions[0], canary_version_id: null, canary_percent: 0 });
    const { rows } = await admin.query("select action from audit_log where tenant_id = $1 and action like 'agent.%' order by id", [owner.tenantId]);
    expect(rows.map((r) => r.action)).toEqual([
      "agent.create", "agent.version.create", "agent.publish", "agent.publish", "agent.version.create", "agent.canary", "agent.rollback",
    ]);
  });
});

describe("permisos", () => {
  it("una API key con agents:write crea versiones pero no publica", async () => {
    const key = (await api("POST", "/v1/api-keys", owner.token, { name: "ci", scopes: ["agents:read", "agents:write"] })).json().token;
    expect((await api("POST", `/v1/agents/${agentId}/versions`, key, { maxSteps: 4 })).statusCode).toBe(201);
    expect((await api("POST", `/v1/agents/${agentId}/publish`, key, { versionId: versions[0] })).statusCode).toBe(403);
  });

  it("otro tenant no ve ni toca los agentes", async () => {
    const other = await sign("otro");
    await api("POST", "/v1/tenants", other, { name: "Otra" });
    expect((await api("GET", "/v1/agents", other)).json().data).toEqual([]);
    expect((await api("POST", `/v1/agents/${agentId}/publish`, other, { versionId: versions[0] })).statusCode).toBe(404);
    expect((await api("GET", `/v1/agents/${agentId}/versions`, other)).json().data).toEqual([]);
  });

  it("sin modelo configurado, evaluar responde 503", async () => {
    const noModel = buildApp({ pool, verifyOidc, rateLimiter: new MemoryRateLimiter() });
    const res = await noModel.inject({
      method: "POST", url: `/v1/agents/${agentId}/versions/${versions[0]}/evaluate`, headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(res.statusCode).toBe(503);
    await noModel.close();
  });
});
