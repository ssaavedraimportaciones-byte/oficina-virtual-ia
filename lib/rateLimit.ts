import { prisma } from './db'

/**
 * Límite por ventana de tiempo, respaldado en Postgres: sobrevive a un
 * restart del servidor y es compartido entre todas las instancias, a
 * diferencia de la versión anterior (un Map en memoria de proceso). Cada
 * intento es una fila; se cuentan las de la ventana vigente y se podan las
 * viejas de esa misma key de paso.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowMs)

  await prisma.rateLimitHit.deleteMany({ where: { key, createdAt: { lt: windowStart } } })

  const count = await prisma.rateLimitHit.count({ where: { key, createdAt: { gte: windowStart } } })

  if (count >= limit) {
    const oldest = await prisma.rateLimitHit.findFirst({
      where: { key },
      orderBy: { createdAt: 'asc' },
    })
    const resetAt = oldest ? oldest.createdAt.getTime() + windowMs : now.getTime() + windowMs
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now.getTime()) / 1000)),
    }
  }

  await prisma.rateLimitHit.create({ data: { key } })
  return { allowed: true, retryAfterSeconds: 0 }
}

/** Se llama después de un login exitoso, para no castigar a quien se equivocó antes de acertar. */
export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimitHit.deleteMany({ where: { key } })
}

/** IP del cliente detrás de un proxy o CDN. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers.get('x-real-ip') ?? 'desconocida'
}
