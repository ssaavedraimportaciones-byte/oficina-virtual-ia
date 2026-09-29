import { createOidcVerifier, type OidcVerifier } from "@pronex/auth";
import { freshDatabase } from "@pronex/db/testing";
import { Redis } from "ioredis";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { MemoryRateLimiter, RedisRateLimiter } from "../src/rate-limit.js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

describe("RedisRateLimiter", () => {
  let redis: Redis;
  beforeAll(() => { redis = new Redis(REDIS_URL); });
  afterAll(async () => { await redis.quit(); });

  it("permite hasta el límite, bloquea después y se reinicia con la ventana", async () => {
    const rl = new RedisRateLimiter(redis, `test:${Date.now()}:`);
    const rule = { limit: 3, windowMs: 400 };
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rl.hit("k", rule));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3]!.resetMs).toBeGreaterThan(0);
    expect(results[3]!.resetMs).toBeLessThanOrEqual(400);

    await new Promise((r) => setTimeout(r, 450));
    expect((await rl.hit("k", rule)).allowed).toBe(true);
  });

  it("es atómico bajo concurrencia (varias réplicas golpeando la misma key)", async () => {
    const rl = new RedisRateLimiter(redis, `test:${Date.now()}:`);
    const rule = { limit: 50, windowMs: 5_000 };
    const results = await Promise.all(Array.from({ length: 120 }, () => rl.hit("burst", rule)));
    expect(results.filter((r) => r.allowed)).toHaveLength(50);
  });

  it("keys distintas no se afectan entre sí", async () => {
    const rl = new RedisRateLimiter(redis, `test:${Date.now()}:`);
    const rule = { limit: 1, windowMs: 5_000 };
    await rl.hit("a", rule);
    expect((await rl.hit("a", rule)).allowed).toBe(false);
    expect((await rl.hit("b", rule)).allowed).toBe(true);
  });
});

describe("rate limiting en la API", () => {
  let admin: pg.Client;
  let pool: pg.Pool;
  let verifyOidc: OidcVerifier;
  let userToken: string;

  beforeAll(async () => {
    ({ admin, app: pool } = await freshDatabase());
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
    verifyOidc = createOidcVerifier({
      issuer: "https://idp.test", audience: "pronex-api", jwks: createLocalJWKSet({ keys: [jwk] }),
    });
    userToken = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer("https://idp.test").setAudience("pronex-api").setSubject("rl-user").setExpirationTime("5m")
      .sign(privateKey);
  });

  afterAll(async () => {
    await pool?.end();
    await admin?.end();
  });

  const limits = (over: Partial<Record<"perIp" | "perApiKey" | "perUser" | "perTenant", number>>) => {
    const r = (limit = 1000) => ({ limit, windowMs: 60_000 });
    return { perIp: r(over.perIp), perApiKey: r(over.perApiKey), perUser: r(over.perUser), perTenant: r(over.perTenant) };
  };

  it("por IP: frena intentos de adivinar credenciales antes de autenticar", async () => {
    const app = buildApp({ pool, verifyOidc, rateLimiter: new MemoryRateLimiter(), rateLimits: limits({ perIp: 3 }) });
    const codes = [];
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ url: "/v1/leads", headers: { authorization: `Bearer pnx_live_AAAAAAAAAAAA_${"x".repeat(43)}` } });
      codes.push(res.statusCode);
    }
    expect(codes).toEqual([401, 401, 401, 429, 429]);
    await app.close();
  });

  it("por API key: 429 con Retry-After, y las demás keys siguen funcionando", async () => {
    const app = buildApp({ pool, verifyOidc, rateLimiter: new MemoryRateLimiter(), rateLimits: limits({ perApiKey: 2 }) });
    const auth = { authorization: `Bearer ${userToken}` };
    const t = await app.inject({ method: "POST", url: "/v1/tenants", headers: auth, payload: { name: "RL" } });
    const mk = async () =>
      (await app.inject({ method: "POST", url: "/v1/api-keys", headers: auth, payload: { name: "k", scopes: ["leads:read"] } })).json().token;
    const [k1, k2] = [await mk(), await mk()];

    const hit = (k: string) => app.inject({ url: "/v1/leads", headers: { authorization: `Bearer ${k}` } });
    expect((await hit(k1)).statusCode).toBe(200);
    expect((await hit(k1)).statusCode).toBe(200);
    const blocked = await hit(k1);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error).toBe("rate_limited");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect((await hit(k2)).statusCode).toBe(200);
    expect(t.statusCode).toBe(201);
    await app.close();
  });

  it("por tenant: el tope agregado aplica aunque se usen varias keys", async () => {
    // Prepara keys con una app sin límites estrictos…
    const setup = buildApp({ pool, verifyOidc, rateLimiter: new MemoryRateLimiter(), rateLimits: limits({}) });
    const auth = { authorization: `Bearer ${userToken}` };
    const mk = async () =>
      (await setup.inject({ method: "POST", url: "/v1/api-keys", headers: auth, payload: { name: "k", scopes: ["leads:read"] } })).json().token as string;
    const [k1, k2] = [await mk(), await mk()];
    await setup.close();

    // …y mide con otra cuyo tope por tenant es 3: la 4ª petición falla aunque cada key vaya en 2.
    const app = buildApp({ pool, verifyOidc, rateLimiter: new MemoryRateLimiter(), rateLimits: limits({ perTenant: 3 }) });
    const codes = [];
    for (const k of [k1, k2, k1, k2]) {
      codes.push((await app.inject({ url: "/v1/leads", headers: { authorization: `Bearer ${k}` } })).statusCode);
    }
    expect(codes).toEqual([200, 200, 200, 429]);
    await app.close();
  });
});
