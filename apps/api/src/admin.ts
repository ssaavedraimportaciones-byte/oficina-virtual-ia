/**
 * Administración del operador de la plataforma (tú), protegida por PRONEX_ADMIN_TOKEN.
 *
 * Sirve para lo que las API keys de un cliente no pueden hacer por diseño: crear
 * empresas nuevas y conectar números de WhatsApp (credenciales de terceros).
 * Si PRONEX_ADMIN_TOKEN no está definido, estas rutas no existen.
 */
import { randomUUID, timingSafeEqual } from "node:crypto";
import { DEMO_AGENT_NAME, DEMO_GOLDEN_CASES, DEMO_PROMPT } from "@pronex/agent";
import { API_KEY_FORBIDDEN, generateApiKey, PERMISSIONS, type SecretBox } from "@pronex/auth";
import { withTenant } from "@pronex/db";
import { credentialsAad } from "@pronex/messaging";
import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { HttpError } from "./auth.js";
import type { RateLimiter } from "./rate-limit.js";

export const ADMIN_HEADER = "x-admin-token";
const MIN_TOKEN_LENGTH = 32;

/** Todos los permisos que una API key puede tener. */
const OWNER_KEY_SCOPES = PERMISSIONS.filter((p) => !API_KEY_FORBIDDEN.has(p));

async function adminAudit(c: PoolClient, tenantId: string, action: string, target: string, detail: object = {}) {
  await c.query(
    "insert into audit_log (tenant_id, actor, action, target, detail) values ($1, 'platform_admin', $2, $3, $4)",
    [tenantId, action, target, detail],
  );
}

export function registerAdminRoutes(
  app: FastifyInstance, pool: Pool, opts: { token: string; secretBox?: SecretBox; rateLimiter: RateLimiter },
) {
  if (opts.token.length < MIN_TOKEN_LENGTH) {
    throw new Error(`PRONEX_ADMIN_TOKEN debe tener al menos ${MIN_TOKEN_LENGTH} caracteres`);
  }
  const expected = Buffer.from(opts.token);

  app.register(async (scope) => {
    scope.addHook("onRequest", async (req, reply) => {
      // Límite por IP antes de comparar: frena la fuerza bruta del token.
      const rl = await opts.rateLimiter.hit(`admin-ip:${req.ip}`, { limit: 30, windowMs: 60_000 });
      if (!rl.allowed) {
        reply.header("retry-after", Math.max(1, Math.ceil(rl.resetMs / 1000)));
        throw new HttpError(429, "rate_limited");
      }
      const got = Buffer.from(String(req.headers[ADMIN_HEADER] ?? ""));
      if (got.length !== expected.length || !timingSafeEqual(got, expected)) throw new HttpError(401, "unauthorized");
    });

    /** Crea una empresa con su workspace y una API key de owner (y, opcional, el agente de ejemplo). */
    scope.post<{ Body: { name: string; demoAgent?: boolean } }>("/admin/tenants", {
      schema: {
        body: {
          type: "object", required: ["name"], additionalProperties: false,
          properties: { name: { type: "string", minLength: 1, maxLength: 200 }, demoAgent: { type: "boolean" } },
        },
      },
    }, async (req, reply) => {
      const tenantId = randomUUID();
      const key = generateApiKey();
      const out = await withTenant(pool, tenantId, async (c) => {
        await c.query("insert into tenants (id, name) values ($1, $2)", [tenantId, req.body.name]);
        const workspaceId = (await c.query("insert into workspaces (tenant_id, name) values ($1, 'Principal') returning id", [tenantId])).rows[0].id;
        let agentId: string | null = null;
        if (req.body.demoAgent) {
          agentId = (await c.query("insert into agents (tenant_id, workspace_id, name) values ($1, $2, $3) returning id", [tenantId, workspaceId, DEMO_AGENT_NAME])).rows[0].id;
          const versionId = (await c.query(
            `insert into agent_versions (tenant_id, agent_id, version, prompt, model, tools, notes, created_by)
             values ($1, $2, 1, $3, 'claude-opus-5-5', '["handoff_to_human","update_lead"]', 'agente de ejemplo', 'platform_admin') returning id`,
            [tenantId, agentId, DEMO_PROMPT],
          )).rows[0].id;
          await c.query("update agents set published_version_id = $2 where id = $1", [agentId, versionId]);
          for (const gc of DEMO_GOLDEN_CASES) {
            await c.query(
              "insert into golden_cases (tenant_id, agent_id, name, turns, expectations) values ($1, $2, $3, $4, $5)",
              [tenantId, agentId, gc.name, JSON.stringify(gc.turns), gc.expectations],
            );
          }
        }
        await c.query(
          `insert into api_keys (tenant_id, name, prefix, secret_hash, scopes, expires_at)
           values ($1, 'owner (creada por el operador)', $2, $3, $4, now() + interval '365 days')`,
          [tenantId, key.prefix, key.secretHash, OWNER_KEY_SCOPES],
        );
        await adminAudit(c, tenantId, "tenant.create", tenantId, { name: req.body.name, demoAgent: !!req.body.demoAgent });
        return { tenantId, workspaceId, agentId };
      });
      // La API key completa solo se muestra aquí.
      return reply.status(201).send({ ...out, apiKey: key.token, apiKeyScopes: OWNER_KEY_SCOPES });
    });

    /** Conecta un número de WhatsApp Business a una empresa (y opcionalmente a un agente). */
    scope.post<{ Params: { tenantId: string }; Body: { phoneNumberId: string; accessToken: string; agentId?: string; displayName?: string } }>(
      "/admin/tenants/:tenantId/channels/whatsapp", {
        schema: {
          params: { type: "object", properties: { tenantId: { type: "string", format: "uuid" } } },
          body: {
            type: "object", required: ["phoneNumberId", "accessToken"], additionalProperties: false,
            properties: {
              phoneNumberId: { type: "string", pattern: "^[0-9]{5,30}$" },
              accessToken: { type: "string", minLength: 20, maxLength: 1024 },
              agentId: { type: "string", format: "uuid" },
              displayName: { type: "string", maxLength: 100 },
            },
          },
        },
      }, async (req, reply) => {
        if (!opts.secretBox) throw new HttpError(503, "whatsapp_not_configured");
        const { tenantId } = req.params;
        const b = req.body;
        const row = await withTenant(pool, tenantId, async (c) => {
          const { rows: [ws] } = await c.query<{ id: string }>("select id from workspaces order by created_at limit 1");
          if (!ws) throw new HttpError(404, "tenant_not_found");
          if (b.agentId && !(await c.query("select 1 from agents where id = $1", [b.agentId])).rowCount) {
            throw new HttpError(404, "agent_not_found");
          }
          const r = await c.query(
            `insert into channel_accounts (tenant_id, workspace_id, channel, external_id, display_name, credentials_enc, agent_id)
             values ($1, $2, 'whatsapp', $3, $4, $5, $6)
             on conflict (channel, external_id) do nothing
             returning id, external_id, display_name, agent_id, created_at`,
            [tenantId, ws.id, b.phoneNumberId, b.displayName ?? null, opts.secretBox!.seal(b.accessToken, credentialsAad(tenantId)), b.agentId ?? null],
          );
          if (!r.rowCount) throw new HttpError(409, "channel_already_connected");
          await adminAudit(c, tenantId, "channel.connect", r.rows[0].id, { channel: "whatsapp", externalId: b.phoneNumberId });
          return r.rows[0];
        });
        return reply.status(201).send(row);
      });
  });
}
