import { createOidcVerifier, SecretBox } from "@pronex/auth";
import { WhatsAppClient } from "@pronex/channels";
import { Redis } from "ioredis";
import pg from "pg";
import { anthropicModelClient } from "@pronex/agent";
import { buildApp } from "./app.js";
import { sweepPendingInbound, type InboundDispatcher } from "@pronex/messaging";
import { temporalDispatcher } from "@pronex/worker/dispatcher";
import { Client, Connection } from "@temporalio/client";
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

// Con Temporal configurado, cada inbound despierta el workflow de su conversación.
// Sin él (desarrollo), el mensaje solo se registra y queda en la bandeja.
const dispatcher: InboundDispatcher = process.env.TEMPORAL_ADDRESS
  ? temporalDispatcher(new Client({
      connection: await Connection.connect({ address: process.env.TEMPORAL_ADDRESS }),
      namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
    }))
  : {
      async dispatch(event) {
        app.log.warn({ event }, "TEMPORAL_ADDRESS no definido: el agente no responderá");
      },
    };

const app = buildApp({
  pool,
  verifyOidc,
  rateLimiter,
  logger: true,
  adminToken: process.env.PRONEX_ADMIN_TOKEN || undefined,
  // Evaluaciones de casos dorados (credenciales: ANTHROPIC_API_KEY o `ant auth login`).
  agentModel: (() => {
    try {
      return anthropicModelClient();
    } catch (err) {
      console.warn(`Sin credenciales de Anthropic: evaluaciones deshabilitadas (${(err as Error).message})`);
      return undefined;
    }
  })(),
  channels: process.env.META_APP_SECRET
    ? {
        secretBox: new SecretBox(required("PRONEX_SECRET_KEY")),
        dispatcher,
        whatsapp: {
          client: new WhatsAppClient({ graphVersion: process.env.META_GRAPH_VERSION, baseUrl: process.env.META_GRAPH_BASE_URL || undefined }),
          appSecret: required("META_APP_SECRET"),
          verifyToken: required("WHATSAPP_VERIFY_TOKEN"),
        },
      }
    : undefined,
});
if (!process.env.META_APP_SECRET) app.log.warn("META_APP_SECRET no definido: canal WhatsApp deshabilitado");

// Barrido del outbox: re-despacha inbound que no llegaron al runtime.
setInterval(() => {
  sweepPendingInbound(pool, dispatcher).catch((err) => app.log.error(err, "sweep falló"));
}, 30_000).unref();

await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 3000) });
