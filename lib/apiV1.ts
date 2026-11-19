import { NextRequest, NextResponse } from 'next/server'
import { logApiAccess, verifyApiKey } from './apiKeys'
import { clientIp, rateLimit } from './rateLimit'

/**
 * Núcleo de la API v1 (solo lectura): autenticación con clave, límite de uso,
 * bitácora de accesos, errores en JSON y paginación por cursor.
 *
 * Cada ruta es un `GET` envuelto en `apiRoute`. No hay ni habrá manejadores de
 * POST/PUT/PATCH/DELETE: un método que no exportan las rutas lo rechaza Next
 * con 405, y la clave solo tiene el alcance `read`.
 */

export const API_VERSION = 'v1'
export const RATE_LIMIT_PER_MINUTE = 60
/** Intentos con clave inválida por IP y minuto, para frenar la fuerza bruta. */
export const FAILED_AUTH_PER_MINUTE = 20

export const DEFAULT_LIMIT = 25
export const MAX_LIMIT = 100

const BASE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-API-Version': API_VERSION,
  'X-Content-Type-Options': 'nosniff',
}

export function apiJson(body: unknown, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, { status, headers: { ...BASE_HEADERS, ...headers } })
}

export function apiError(status: number, code: string, message: string, headers: Record<string, string> = {}): NextResponse {
  return apiJson({ error: { code, message } }, status, headers)
}

/** Error de parámetros del pedido (400): se lanza desde los parsers y `apiRoute` lo convierte. */
export class BadRequest extends Error {}

export interface ApiContext {
  request: NextRequest
  url: URL
  keyId: string
}

const AUTH_MESSAGES: Record<string, string> = {
  missing: 'Falta el encabezado Authorization: Bearer <clave>.',
  malformed: 'El encabezado Authorization debe ser "Bearer <clave>".',
  invalid: 'La clave no es válida.',
  revoked: 'La clave fue revocada.',
  scope: 'La clave no tiene el alcance necesario.',
}

/**
 * Envuelve un GET de la API: valida la clave, aplica el límite (60 pedidos por
 * minuto por clave), anota el acceso y entrega errores JSON uniformes.
 */
export function apiRoute(handler: (ctx: ApiContext) => Promise<NextResponse>) {
  return async function GET(request: NextRequest): Promise<NextResponse> {
    const ip = clientIp(request.headers)
    const url = request.nextUrl
    // Se espera la escritura: en un servidor sin estado, lo que queda pendiente al responder puede cortarse.
    const log = async (res: NextResponse, keyId: string | null, keyPrefix: string | null) => {
      await logApiAccess({ keyId, keyPrefix, method: request.method, path: url.pathname, status: res.status, ip })
      return res
    }

    const auth = await verifyApiKey(request.headers.get('authorization'))
    if (!auth.ok) {
      const limited = await rateLimit(`api-fail:${ip}`, FAILED_AUTH_PER_MINUTE, 60_000)
      if (!limited.allowed) {
        const res = apiError(429, 'rate_limited', 'Demasiados intentos con clave inválida.', { 'Retry-After': String(limited.retryAfterSeconds) })
        return await log(res, null, auth.prefix)
      }
      const res = apiError(401, 'unauthorized', AUTH_MESSAGES[auth.reason], { 'WWW-Authenticate': 'Bearer' })
      return await log(res, null, auth.prefix)
    }

    const limit = await rateLimit(`api:${auth.keyId}`, RATE_LIMIT_PER_MINUTE, 60_000)
    if (!limit.allowed) {
      const res = apiError(429, 'rate_limited', `Máximo ${RATE_LIMIT_PER_MINUTE} pedidos por minuto.`, {
        'Retry-After': String(limit.retryAfterSeconds),
        'RateLimit-Limit': String(RATE_LIMIT_PER_MINUTE),
      })
      return await log(res, auth.keyId, auth.prefix)
    }

    try {
      const res = await handler({ request, url, keyId: auth.keyId })
      return await log(res, auth.keyId, auth.prefix)
    } catch (error) {
      if (error instanceof BadRequest) return await log(apiError(400, 'bad_request', error.message), auth.keyId, auth.prefix)
      // El detalle va a los registros del servidor, nunca a quien llama.
      console.error('[api v1] error inesperado:', error)
      return await log(apiError(500, 'internal_error', 'Error interno.'), auth.keyId, auth.prefix)
    }
  }
}

// --- Paginación por cursor -------------------------------------------------

export interface Page {
  limit: number
  cursor: { t: Date; id: string } | null
}

/** Cursor opaco: fecha ISO + id del último elemento de la página anterior. */
export function encodeCursor(t: Date, id: string): string {
  return Buffer.from(`${t.toISOString()}|${id}`).toString('base64url')
}

export function decodeCursor(raw: string): { t: Date; id: string } {
  const text = Buffer.from(raw, 'base64url').toString()
  const i = text.indexOf('|')
  const t = new Date(text.slice(0, i))
  const id = text.slice(i + 1)
  if (i < 0 || Number.isNaN(t.getTime()) || !id) throw new BadRequest('El cursor no es válido.')
  return { t, id }
}

export function parsePage(url: URL): Page {
  const rawLimit = url.searchParams.get('limit')
  let limit = DEFAULT_LIMIT
  if (rawLimit !== null) {
    limit = Number(rawLimit)
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new BadRequest(`limit debe ser un entero entre 1 y ${MAX_LIMIT}.`)
    }
  }
  const rawCursor = url.searchParams.get('cursor')
  return { limit, cursor: rawCursor ? decodeCursor(rawCursor) : null }
}

/** Condición "viene después del cursor" para un orden descendente por (campo, id). */
export function afterCursor<F extends string>(field: F, cursor: { t: Date; id: string } | null) {
  if (!cursor) return {}
  return { OR: [{ [field]: { lt: cursor.t } }, { [field]: cursor.t, id: { lt: cursor.id } }] }
}

/**
 * Corta `rows` (pedidas con take = limit + 1) en una página y arma el cursor
 * siguiente. `at` dice de qué campo de fecha sale el orden.
 */
export function paginate<T extends { id: string }>(rows: T[], limit: number, at: (row: T) => Date) {
  const hasMore = rows.length > limit
  const data = hasMore ? rows.slice(0, limit) : rows
  const last = data[data.length - 1]
  return {
    data,
    page: { limit, hasMore, nextCursor: hasMore && last ? encodeCursor(at(last), last.id) : null },
  }
}

/** Fecha opcional de un parámetro (`from`, `to`): ISO 8601 o falla con 400. */
export function parseDateParam(url: URL, name: string): Date | null {
  const raw = url.searchParams.get(name)
  if (raw === null || raw === '') return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) throw new BadRequest(`${name} debe ser una fecha ISO 8601 (ej. 2026-11-01 o 2026-11-01T00:00:00Z).`)
  return d
}

export function parseEnumParam<T extends string>(url: URL, name: string, allowed: readonly T[]): T | null {
  const raw = url.searchParams.get(name)
  if (raw === null || raw === '') return null
  if (!(allowed as readonly string[]).includes(raw)) throw new BadRequest(`${name} debe ser uno de: ${allowed.join(', ')}.`)
  return raw as T
}

export function parseBoolParam(url: URL, name: string): boolean | null {
  const raw = url.searchParams.get(name)
  if (raw === null || raw === '') return null
  if (raw !== 'true' && raw !== 'false') throw new BadRequest(`${name} debe ser true o false.`)
  return raw === 'true'
}
