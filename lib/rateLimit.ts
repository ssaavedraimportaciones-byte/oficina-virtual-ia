interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/**
 * Límite por ventana de tiempo, en memoria. Alcanza para frenar fuerza bruta
 * contra el login en un despliegue de una sola instancia; con varias instancias
 * hay que moverlo a Redis o al WAF del hosting, porque cada proceso tiene su
 * propio contador.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  bucket.count += 1
  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }

  return { allowed: true, retryAfterSeconds: 0 }
}

export function resetRateLimit(key?: string): void {
  if (key) buckets.delete(key)
  else buckets.clear()
}

/** IP del cliente detrás de un proxy o CDN. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers.get('x-real-ip') ?? 'desconocida'
}
