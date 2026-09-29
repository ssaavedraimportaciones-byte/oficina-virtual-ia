import { createOidcVerifier, parseApiKey } from "@pronex/auth";
import { freshDatabase } from "@pronex/db/testing";
import type { FastifyInstance } from "fastify";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { MemoryRateLimiter } from "../src/rate-limit.js";

const ISSUER = "https://idp.test";
const AUDIENCE = "pronex-api";

let admin: pg.Client;
let pool: pg.Pool;
let app: FastifyInstance;
let signFor: (sub: string, email?: string) => Promise<string>;

// Estado compartido entre tests (el orden importa y es intencional: cuenta una historia).
const ana = { token: "", tenantId: "", workspaceId: "" };
const bob = { token: "", tenantId: "", workspaceId: "" };
let readKey = { id: "", token: "" };

const call = (method: string, url: string, token?: string, body?: object, headers: Record<string, string> = {}) =>
  app.inject({
    method: method as "GET",
    url,
    payload: body,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
  });

beforeAll(async () => {
  ({ admin, app: pool } = await freshDatabase());
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
  signFor = (sub, email) =>
    new SignJWT(email ? { email } : {})
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(ISSUER).setAudience(AUDIENCE).setSubject(sub).setIssuedAt().setExpirationTime("5m")
      .sign(privateKey);
  const verifyOidc = createOidcVerifier({ issuer: ISSUER, audience: AUDIENCE, jwks: createLocalJWKSet({ keys: [jwk] }) });
  app = buildApp({ pool, verifyOidc, rateLimiter: new MemoryRateLimiter() });
  await app.ready();

  ana.token = await signFor("ana", "ana@pyme.cl");
  bob.token = await signFor("bob", "bob@otra.cl");
});

afterAll(async () => {
  await app?.close();
  await pool?.end();
  await admin?.end();
});

describe("autenticación", () => {
  it("sin credenciales → 401, incluso con body inválido", async () => {
    expect((await call("GET", "/v1/leads")).statusCode).toBe(401);
    expect((await call("POST", "/v1/leads", undefined, { basura: true })).statusCode).toBe(401);
  });

  it("token basura, key mal formada o key inexistente → 401", async () => {
    expect((await call("GET", "/v1/leads", "no-es-un-jwt")).statusCode).toBe(401);
    expect((await call("GET", "/v1/leads", "pnx_live_corta")).statusCode).toBe(401);
    const fake = `pnx_live_AAAAAAAAAAAA_${"x".repeat(43)}`;
    expect((await call("GET", "/v1/leads", fake)).statusCode).toBe(401);
  });

  it("health es público y rutas inexistentes dan 404", async () => {
    expect((await call("GET", "/health")).statusCode).toBe(200);
    expect((await call("GET", "/v1/no-existe", ana.token)).statusCode).toBe(404);
  });
});

describe("onboarding self-serve", () => {
  it("un usuario nuevo sin tenant puede autenticarse pero no leer datos", async () => {
    const res = await call("GET", "/v1/leads", ana.token);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("tenant_required");
  });

  it("crea su tenant y queda como owner", async () => {
    const res = await call("POST", "/v1/tenants", ana.token, { name: "PyME de Ana" });
    expect(res.statusCode).toBe(201);
    Object.assign(ana, res.json());

    const me = await call("GET", "/v1/me", ana.token);
    expect(me.json().memberships).toEqual([{ tenantId: ana.tenantId, role: "owner" }]);

    const r2 = await call("POST", "/v1/tenants", bob.token, { name: "Empresa de Bob" });
    Object.assign(bob, r2.json());
  });

  it("owner crea y lista leads", async () => {
    const created = await call("POST", "/v1/leads", ana.token, {
      workspaceId: ana.workspaceId, fullName: "Cliente 1", phone: "+56911111111",
    });
    expect(created.statusCode).toBe(201);
    await call("POST", "/v1/leads", bob.token, { workspaceId: bob.workspaceId, fullName: "Cliente de Bob" });

    const list = await call("GET", "/v1/leads", ana.token);
    expect(list.json().data.map((l: { full_name: string }) => l.full_name)).toEqual(["Cliente 1"]);
  });

  it("valida el body una vez autenticado", async () => {
    const res = await call("POST", "/v1/leads", ana.token, { workspaceId: "no-uuid" });
    expect(res.statusCode).toBe(400);
  });
});

describe("aislamiento en la API", () => {
  it("Bob no puede operar en el tenant de Ana aunque conozca su id", async () => {
    const res = await call("GET", "/v1/leads", bob.token, undefined, { "x-pronex-tenant": ana.tenantId });
    expect(res.statusCode).toBe(403);
  });

  it("Bob no puede crear leads en un workspace de Ana", async () => {
    const res = await call("POST", "/v1/leads", bob.token, { workspaceId: ana.workspaceId, fullName: "intruso" });
    expect(res.statusCode).toBe(404);
  });

  it("header de tenant mal formado → 400", async () => {
    const res = await call("GET", "/v1/leads", ana.token, undefined, { "x-pronex-tenant": "' or 1=1" });
    expect(res.statusCode).toBe(400);
  });
});

describe("API keys", () => {
  it("owner crea una key de solo lectura; el token se ve una sola vez", async () => {
    const res = await call("POST", "/v1/api-keys", ana.token, { name: "CRM", scopes: ["leads:read"] });
    expect(res.statusCode).toBe(201);
    readKey = { id: res.json().id, token: res.json().token };
    expect(readKey.token).toMatch(/^pnx_live_/);

    const list = await call("GET", "/v1/api-keys", ana.token);
    expect(JSON.stringify(list.json())).not.toContain(parseApiKey(readKey.token)!.secret);
  });

  it("en la BD solo queda el hash, nunca el secreto", async () => {
    const { secret } = parseApiKey(readKey.token)!;
    const { rows } = await admin.query("select secret_hash::text as h, prefix from api_keys where id = $1", [readKey.id]);
    expect(rows[0].h).not.toContain(secret);
    expect(readKey.token).toContain(rows[0].prefix);
  });

  it("la app no puede leer secret_hash directamente", async () => {
    await expect(pool.query("select secret_hash from api_keys")).rejects.toThrow(/permission denied/);
  });

  it("prefijo real con secreto incorrecto → 401", async () => {
    const { prefix, secret } = parseApiKey(readKey.token)!;
    const wrong = `pnx_live_${prefix}_${secret.slice(0, -1)}${secret.endsWith("A") ? "B" : "A"}`;
    expect((await call("GET", "/v1/leads", wrong)).statusCode).toBe(401);
  });

  it("la key lee leads de su tenant y nada más", async () => {
    const res = await call("GET", "/v1/leads", readKey.token);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.map((l: { full_name: string }) => l.full_name)).toEqual(["Cliente 1"]);
  });

  it("la key no puede escribir fuera de su scope", async () => {
    const res = await call("POST", "/v1/leads", readKey.token, { workspaceId: ana.workspaceId });
    expect(res.statusCode).toBe(403);
  });

  it("una key nunca puede crear otras keys", async () => {
    const res = await call("POST", "/v1/api-keys", readKey.token, { name: "x", scopes: ["leads:read"] });
    expect(res.statusCode).toBe(403);
  });

  it("no se pueden pedir scopes prohibidos o inexistentes", async () => {
    const res = await call("POST", "/v1/api-keys", ana.token, { name: "x", scopes: ["api_keys:manage", "root"] });
    expect(res.statusCode).toBe(400);
    expect(res.json().scopes).toEqual(["api_keys:manage", "root"]);
  });

  it("una key expirada deja de funcionar", async () => {
    const res = await call("POST", "/v1/api-keys", ana.token, { name: "temporal", scopes: ["leads:read"] });
    await admin.query("update api_keys set expires_at = now() - interval '1 minute' where id = $1", [res.json().id]);
    expect((await call("GET", "/v1/leads", res.json().token)).statusCode).toBe(401);
  });

  it("Bob no puede revocar la key de Ana", async () => {
    expect((await call("DELETE", `/v1/api-keys/${readKey.id}`, bob.token)).statusCode).toBe(404);
    expect((await call("GET", "/v1/leads", readKey.token)).statusCode).toBe(200);
  });

  it("revocada, la key deja de funcionar de inmediato", async () => {
    expect((await call("DELETE", `/v1/api-keys/${readKey.id}`, ana.token)).statusCode).toBe(204);
    expect((await call("GET", "/v1/leads", readKey.token)).statusCode).toBe(401);
  });

  it("todo queda en el log de auditoría", async () => {
    const { rows } = await admin.query(
      "select action from audit_log where tenant_id = $1 order by id", [ana.tenantId],
    );
    expect(rows.map((r) => r.action)).toEqual([
      "tenant.create", "lead.create", "api_key.create", "api_key.create", "api_key.revoke",
    ]);
  });
});

describe("roles", () => {
  let carla = "";

  beforeAll(async () => {
    carla = await signFor("carla");
    await call("GET", "/v1/me", carla); // crea el usuario
    const { rows } = await admin.query("select id from users where subject = 'carla'");
    await admin.query("insert into memberships (tenant_id, user_id, role) values ($1, $2, 'viewer')", [ana.tenantId, rows[0].id]);
  });

  it("viewer lee pero no escribe ni gestiona keys", async () => {
    expect((await call("GET", "/v1/leads", carla)).statusCode).toBe(200);
    expect((await call("POST", "/v1/leads", carla, { workspaceId: ana.workspaceId })).statusCode).toBe(403);
    expect((await call("POST", "/v1/api-keys", carla, { name: "x", scopes: ["leads:read"] })).statusCode).toBe(403);
  });

  it("con varias membresías hay que elegir tenant explícitamente", async () => {
    const { rows } = await admin.query("select id from users where subject = 'carla'");
    await admin.query("insert into memberships (tenant_id, user_id, role) values ($1, $2, 'agent')", [bob.tenantId, rows[0].id]);

    expect((await call("GET", "/v1/leads", carla)).json().error).toBe("tenant_required");
    const inBob = await call("POST", "/v1/leads", carla, { workspaceId: bob.workspaceId }, { "x-pronex-tenant": bob.tenantId });
    expect(inBob.statusCode).toBe(201); // en Bob es 'agent' y puede escribir
    const inAna = await call("POST", "/v1/leads", carla, { workspaceId: ana.workspaceId }, { "x-pronex-tenant": ana.tenantId });
    expect(inAna.statusCode).toBe(403); // en Ana sigue siendo 'viewer'
  });
});
