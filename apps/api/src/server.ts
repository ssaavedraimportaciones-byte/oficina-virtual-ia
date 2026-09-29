import { createOidcVerifier } from "@pronex/auth";
import { Redis } from "ioredis";
import pg from "pg";
import { buildApp } from "./app.js";
import { MemoryRateLimiter, RedisRateLimiter } from "./rate-limit.js";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

const pool = new pg.Pool({ connectionString: required("APP_DATABASE_URL"), max: 20 });
const verifyOidc = createOidcVerifier({ issuer: required("OIDC_ISSUER"), audience: required("OIDC_AUDIENCE") });
const rateLimiter = process.env.REDIS_URL
  ? new RedisRateLimiter(new Redis(process.env.REDIS_URL))
  : new MemoryRateLimiter();
if (!process.env.REDIS_URL) console.warn("REDIS_URL no definido: rate limiting en memoria (solo 1 réplica)");
const app = buildApp({ pool, verifyOidc, rateLimiter, logger: true });

await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 3000) });
