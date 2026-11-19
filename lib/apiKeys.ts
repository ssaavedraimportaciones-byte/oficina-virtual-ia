import { createHash, randomBytes } from 'crypto'
import { prisma } from './db'

/**
 * Claves de la API v1 (solo lectura) para sistemas externos como Houston Ops.
 *
 * - La clave en texto solo existe en el momento de crearla: en la base queda el
 *   hash SHA-256. Un volcado de la base no sirve para llamar a la API.
 * - Tiene 256 bits de azar, así que un hash rápido alcanza (no es una
 *   contraseña elegida por una persona que se pueda adivinar).
 * - Se puede revocar al instante o rotar con un período de gracia: la clave
 *   vieja sigue sirviendo unas horas para cambiarla en el otro sistema sin corte.
 */

export const KEY_PREFIX = 'zvk_live_'
export const ROTATION_GRACE_HOURS = 24

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function generateApiKey(): { key: string; prefix: string; keyHash: string } {
  const key = `${KEY_PREFIX}${randomBytes(32).toString('base64url')}`
  return { key, prefix: key.slice(0, KEY_PREFIX.length + 4), keyHash: hashApiKey(key) }
}

export interface ApiKeyInfo {
  id: string
  name: string
  prefix: string
  scope: string
  createdAt: string
  lastUsedAt: string | null
  /** null = vigente; en el futuro = en período de gracia; en el pasado = revocada. */
  revokedAt: string | null
  state: 'activa' | 'por_vencer' | 'revocada'
}

function toInfo(
  row: { id: string; name: string; prefix: string; scope: string; createdAt: Date; lastUsedAt: Date | null; revokedAt: Date | null },
  now = new Date(),
): ApiKeyInfo {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scope: row.scope,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    state: !row.revokedAt ? 'activa' : row.revokedAt > now ? 'por_vencer' : 'revocada',
  }
}

export async function listApiKeys(): Promise<ApiKeyInfo[]> {
  const rows = await prisma.apiKey.findMany({ orderBy: { createdAt: 'desc' } })
  return rows.map((r) => toInfo(r))
}

/** Crea una clave. Devuelve el texto completo UNA vez: no se puede recuperar después. */
export async function createApiKey(name: string, createdById: string | null): Promise<{ info: ApiKeyInfo; key: string }> {
  const { key, prefix, keyHash } = generateApiKey()
  const row = await prisma.apiKey.create({ data: { name: name.trim().slice(0, 80) || 'Sin nombre', prefix, keyHash, scope: 'read', createdById } })
  return { info: toInfo(row), key }
}

export async function revokeApiKey(id: string, at: Date = new Date()): Promise<ApiKeyInfo | null> {
  const existing = await prisma.apiKey.findUnique({ where: { id } })
  if (!existing) return null
  // Revocar de nuevo no la "resucita" ni alarga: se queda con la fecha más temprana.
  const revokedAt = existing.revokedAt && existing.revokedAt < at ? existing.revokedAt : at
  return toInfo(await prisma.apiKey.update({ where: { id }, data: { revokedAt } }))
}

/** Rotar: emite una clave nueva y deja la vieja vigente solo `graceHours` más. */
export async function rotateApiKey(
  id: string,
  createdById: string | null,
  graceHours = ROTATION_GRACE_HOURS,
): Promise<{ info: ApiKeyInfo; key: string; previous: ApiKeyInfo } | null> {
  const old = await prisma.apiKey.findUnique({ where: { id } })
  if (!old || (old.revokedAt && old.revokedAt <= new Date())) return null
  const created = await createApiKey(old.name, createdById)
  const previous = await revokeApiKey(id, new Date(Date.now() + graceHours * 3_600_000))
  return { ...created, previous: previous! }
}

export type VerifyResult =
  | { ok: true; keyId: string; prefix: string; scope: string }
  | { ok: false; reason: 'missing' | 'malformed' | 'invalid' | 'revoked' | 'scope'; prefix: string | null }

/** Valida el encabezado `Authorization: Bearer <clave>` contra la base. */
export async function verifyApiKey(authorization: string | null, now = new Date()): Promise<VerifyResult> {
  if (!authorization) return { ok: false, reason: 'missing', prefix: null }
  const match = authorization.match(/^Bearer\s+(\S+)$/i)
  if (!match) return { ok: false, reason: 'malformed', prefix: null }
  const key = match[1]
  if (!key.startsWith(KEY_PREFIX) || key.length > 200) return { ok: false, reason: 'invalid', prefix: null }

  const row = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(key) } })
  if (!row) return { ok: false, reason: 'invalid', prefix: key.slice(0, KEY_PREFIX.length + 4) }
  if (row.revokedAt && row.revokedAt <= now) return { ok: false, reason: 'revoked', prefix: row.prefix }
  if (row.scope !== 'read') return { ok: false, reason: 'scope', prefix: row.prefix }

  // Se anota el último uso como mucho una vez por minuto: no es una escritura por pedido.
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > 60_000) {
    await prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: now } }).catch(() => {})
  }
  return { ok: true, keyId: row.id, prefix: row.prefix, scope: row.scope }
}

const LOG_RETENTION_DAYS = 90

export async function logApiAccess(entry: {
  keyId: string | null
  keyPrefix: string | null
  method: string
  path: string
  status: number
  ip: string | null
}): Promise<void> {
  try {
    await prisma.apiAccessLog.create({ data: { ...entry, path: entry.path.slice(0, 200) } })
    // Poda barata y ocasional: la bitácora no crece sin límite.
    if (Math.random() < 0.01) {
      await prisma.apiAccessLog.deleteMany({ where: { at: { lt: new Date(Date.now() - LOG_RETENTION_DAYS * 86_400_000) } } })
    }
  } catch (error) {
    console.error('[api v1] no se pudo anotar el acceso:', error)
  }
}

export interface ApiAccessEntry {
  at: string
  keyPrefix: string | null
  method: string
  path: string
  status: number
  ip: string | null
}

export async function listApiAccess(limit = 50): Promise<ApiAccessEntry[]> {
  const rows = await prisma.apiAccessLog.findMany({ orderBy: { at: 'desc' }, take: limit })
  return rows.map((r) => ({ at: r.at.toISOString(), keyPrefix: r.keyPrefix, method: r.method, path: r.path, status: r.status, ip: r.ip }))
}
