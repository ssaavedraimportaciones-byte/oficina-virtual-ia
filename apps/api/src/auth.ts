import {
  InvalidTokenError,
  isPermission,
  looksLikeApiKey,
  parseApiKey,
  verifySecret,
  type OidcVerifier,
  type Principal,
  type Role,
} from "@pronex/auth";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TENANT_HEADER = "x-pronex-tenant";

/** Error HTTP con código estable; el mensaje es seguro para el cliente. */
export class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

/** Usuario autenticado por OIDC pero aún sin tenant elegido (p. ej. onboarding). */
export interface Identity {
  userId: string;
  memberships: { tenantId: string; role: Role }[];
}

export type AuthResult = { principal: Principal; identity?: Identity } | { principal: null; identity: Identity };

export async function authenticate(req: FastifyRequest, pool: Pool, verifyOidc: OidcVerifier): Promise<AuthResult> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new HttpError(401, "unauthorized");
  const token = header.slice(7).trim();

  if (looksLikeApiKey(token)) return { principal: await authenticateApiKey(token, pool) };

  let oidc;
  try {
    oidc = await verifyOidc(token);
  } catch (err) {
    if (err instanceof InvalidTokenError) throw new HttpError(401, "unauthorized");
    throw err;
  }

  const { rows: [user] } = await pool.query<{ id: string }>(
    "select app.upsert_user($1, $2, $3) as id", [oidc.issuer, oidc.subject, oidc.email],
  );
  const { rows } = await pool.query<{ tenant_id: string; role: Role }>(
    "select tenant_id, role from app.user_memberships($1)", [user!.id],
  );
  const identity: Identity = {
    userId: user!.id,
    memberships: rows.map((r) => ({ tenantId: r.tenant_id, role: r.role })),
  };

  const requested = req.headers[TENANT_HEADER];
  if (requested !== undefined && (typeof requested !== "string" || !UUID_RE.test(requested))) {
    throw new HttpError(400, "invalid_tenant_header");
  }
  let membership;
  if (requested) {
    membership = identity.memberships.find((m) => m.tenantId === requested);
    // Mismo error que "no existe": no revelamos qué tenants existen.
    if (!membership) throw new HttpError(403, "forbidden");
  } else if (identity.memberships.length === 1) {
    membership = identity.memberships[0];
  }
  if (!membership) return { principal: null, identity };

  return {
    principal: { kind: "user", userId: identity.userId, tenantId: membership.tenantId, role: membership.role },
    identity,
  };
}

async function authenticateApiKey(token: string, pool: Pool): Promise<Principal> {
  const parsed = parseApiKey(token);
  if (!parsed) throw new HttpError(401, "unauthorized");
  const { rows: [key] } = await pool.query<{ id: string; tenant_id: string; secret_hash: Buffer; scopes: string[] }>(
    "select * from app.resolve_api_key($1)", [parsed.prefix],
  );
  if (!key || !verifySecret(parsed.secret, key.secret_hash)) throw new HttpError(401, "unauthorized");
  return {
    kind: "api_key",
    keyId: key.id,
    tenantId: key.tenant_id,
    scopes: new Set(key.scopes.filter(isPermission)),
  };
}

export function sendError(reply: FastifyReply, err: HttpError) {
  return reply.status(err.status).send({ error: err.code });
}
