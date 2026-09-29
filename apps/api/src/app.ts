import { API_KEY_FORBIDDEN, can, generateApiKey, isPermission, type OidcVerifier, type Permission, type Principal } from "@pronex/auth";
import { withTenant } from "@pronex/db";
import Fastify, { type FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, HttpError, sendError, type Identity } from "./auth.js";

declare module "fastify" {
  interface FastifyContextConfig {
    /** Permiso requerido. Obligatorio en toda ruta /v1 salvo las marcadas `identityOnly`. */
    permission?: Permission;
    /** La ruta solo necesita un usuario autenticado, sin tenant (p. ej. crear tenant). */
    identityOnly?: boolean;
  }
  interface FastifyRequest {
    principal: Principal | null;
    identity: Identity | null;
  }
}

export interface AppDeps {
  pool: Pool;
  verifyOidc: OidcVerifier;
  logger?: boolean;
}

function actorOf(p: Principal): string {
  return p.kind === "user" ? `user:${p.userId}` : `api_key:${p.keyId}`;
}

async function audit(c: PoolClient, p: Principal, action: string, target: string | null, detail: object = {}) {
  await c.query(
    "insert into audit_log (tenant_id, actor, action, target, detail) values ($1, $2, $3, $4, $5)",
    [p.tenantId, actorOf(p), action, target, detail],
  );
}

export function buildApp({ pool, verifyOidc, logger = false }: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: logger && { redact: ["req.headers.authorization"] },
    bodyLimit: 256 * 1024,
  });

  app.decorateRequest("principal", null);
  app.decorateRequest("identity", null);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return sendError(reply, err);
    const e = err as { validation?: unknown; statusCode?: number };
    if (e.validation) return reply.status(400).send({ error: "invalid_request", detail: (err as Error).message });
    if (e.statusCode && e.statusCode < 500) return reply.status(e.statusCode).send({ error: "bad_request" });
    app.log.error(err);
    return reply.status(500).send({ error: "internal" });
  });

  // Deny-by-default: una ruta /v1 sin permiso declarado responde 500 en vez de quedar abierta.
  // onRequest: autentica antes de parsear/validar el body, así un anónimo nunca ve errores de validación.
  app.addHook("onRequest", async (req) => {
    if (!req.url.startsWith("/v1/") || !req.routeOptions.url) return; // rutas inexistentes → 404 normal
    const cfg = req.routeOptions.config;
    if (!cfg.permission && !cfg.identityOnly) throw new Error(`Ruta sin permiso declarado: ${req.routeOptions.url}`);

    const result = await authenticate(req, pool, verifyOidc);
    req.principal = result.principal;
    req.identity = result.identity ?? null;

    if (cfg.identityOnly) {
      if (!req.identity) throw new HttpError(403, "user_token_required");
      return;
    }
    if (!req.principal) throw new HttpError(400, "tenant_required");
    if (!can(req.principal, cfg.permission!)) throw new HttpError(403, "forbidden");
  });

  app.get("/health", async () => ({ ok: true }));

  // --- Identidad y onboarding -------------------------------------------------

  app.post<{ Body: { name: string } }>("/v1/tenants", {
    config: { identityOnly: true },
    schema: {
      body: {
        type: "object", required: ["name"], additionalProperties: false,
        properties: { name: { type: "string", minLength: 1, maxLength: 200 } },
      },
    },
  }, async (req, reply) => {
    const { rows: [row] } = await pool.query<{ id: string }>(
      "select app.create_tenant($1, $2) as id", [req.body.name, req.identity!.userId],
    );
    const tenantId = row!.id;
    const owner: Principal = { kind: "user", userId: req.identity!.userId, tenantId, role: "owner" };
    const workspaceId = await withTenant(pool, tenantId, async (c) => {
      const ws = await c.query<{ id: string }>(
        "insert into workspaces (tenant_id, name) values ($1, 'Principal') returning id", [tenantId],
      );
      await audit(c, owner, "tenant.create", tenantId, { name: req.body.name });
      return ws.rows[0]!.id;
    });
    return reply.status(201).send({ tenantId, workspaceId });
  });

  app.get("/v1/me", { config: { identityOnly: true } }, async (req) => ({
    userId: req.identity!.userId,
    memberships: req.identity!.memberships,
  }));

  // --- Leads -------------------------------------------------------------------

  app.get("/v1/leads", { config: { permission: "leads:read" } }, async (req) => {
    const p = req.principal!;
    const { rows } = await withTenant(pool, p.tenantId, (c) =>
      c.query("select id, workspace_id, full_name, phone, email, created_at from leads order by created_at desc limit 100"),
    );
    return { data: rows };
  });

  app.post<{ Body: { workspaceId: string; fullName?: string; phone?: string; email?: string } }>("/v1/leads", {
    config: { permission: "leads:write" },
    schema: {
      body: {
        type: "object", required: ["workspaceId"], additionalProperties: false,
        properties: {
          workspaceId: { type: "string", format: "uuid" },
          fullName: { type: "string", maxLength: 200 },
          phone: { type: "string", maxLength: 32 },
          email: { type: "string", format: "email", maxLength: 320 },
        },
      },
    },
  }, async (req, reply) => {
    const p = req.principal!;
    const b = req.body;
    const lead = await withTenant(pool, p.tenantId, async (c) => {
      // Un workspace de otro tenant es invisible por RLS → la FK compuesta falla → 404.
      const ws = await c.query("select 1 from workspaces where id = $1", [b.workspaceId]);
      if (!ws.rowCount) throw new HttpError(404, "workspace_not_found");
      const { rows } = await c.query(
        `insert into leads (tenant_id, workspace_id, full_name, phone, email)
         values ($1, $2, $3, $4, $5) returning id, workspace_id, full_name, phone, email, created_at`,
        [p.tenantId, b.workspaceId, b.fullName ?? null, b.phone ?? null, b.email ?? null],
      );
      await audit(c, p, "lead.create", rows[0].id);
      return rows[0];
    });
    return reply.status(201).send(lead);
  });

  // --- API keys ----------------------------------------------------------------

  app.post<{ Body: { name: string; scopes: string[]; expiresInDays?: number } }>("/v1/api-keys", {
    config: { permission: "api_keys:manage" },
    schema: {
      body: {
        type: "object", required: ["name", "scopes"], additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          scopes: { type: "array", minItems: 1, maxItems: 20, uniqueItems: true, items: { type: "string" } },
          expiresInDays: { type: "integer", minimum: 1, maximum: 365 },
        },
      },
    },
  }, async (req, reply) => {
    const p = req.principal!;
    const { name, scopes, expiresInDays = 90 } = req.body;
    const invalid = scopes.filter((s) => !isPermission(s) || API_KEY_FORBIDDEN.has(s));
    if (invalid.length) return reply.status(400).send({ error: "invalid_scopes", scopes: invalid });

    const key = generateApiKey();
    const row = await withTenant(pool, p.tenantId, async (c) => {
      const { rows } = await c.query(
        `insert into api_keys (tenant_id, name, prefix, secret_hash, scopes, created_by, expires_at)
         values ($1, $2, $3, $4, $5, $6, now() + make_interval(days => $7))
         returning id, name, prefix, scopes, expires_at, created_at`,
        [p.tenantId, name, key.prefix, key.secretHash, scopes, p.kind === "user" ? p.userId : null, expiresInDays],
      );
      await audit(c, p, "api_key.create", rows[0].id, { scopes });
      return rows[0];
    });
    // El token completo solo se devuelve aquí, una única vez.
    return reply.status(201).send({ ...row, token: key.token });
  });

  app.get("/v1/api-keys", { config: { permission: "api_keys:manage" } }, async (req) => {
    const { rows } = await withTenant(pool, req.principal!.tenantId, (c) =>
      c.query(`select id, name, prefix, scopes, expires_at, revoked_at, last_used_at, created_at
               from api_keys order by created_at desc`),
    );
    return { data: rows };
  });

  app.delete<{ Params: { id: string } }>("/v1/api-keys/:id", {
    config: { permission: "api_keys:manage" },
    schema: { params: { type: "object", properties: { id: { type: "string", format: "uuid" } } } },
  }, async (req, reply) => {
    const p = req.principal!;
    const revoked = await withTenant(pool, p.tenantId, async (c) => {
      const r = await c.query(
        "update api_keys set revoked_at = now() where id = $1 and revoked_at is null returning id", [req.params.id],
      );
      if (r.rowCount) await audit(c, p, "api_key.revoke", req.params.id);
      return r.rowCount;
    });
    if (!revoked) throw new HttpError(404, "not_found");
    return reply.status(204).send();
  });

  return app;
}
