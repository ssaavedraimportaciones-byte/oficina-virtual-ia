import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPassword, cookieName } from '@/lib/adminAuth'
import { clientIp, rateLimit, resetRateLimit } from '@/lib/rateLimit'

const schema = z.object({
  password: z.string().min(1),
  scope: z.enum(['admin', 'panel']).default('admin'),
})

/** Ventana de fuerza bruta: 8 intentos fallidos cada 15 minutos por IP. */
const MAX_ATTEMPTS = 8
const WINDOW_MS = 15 * 60 * 1000

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Contraseña requerida' }, { status: 400 })
  }

  const { scope, password } = parsed.data
  const key = `login:${scope}:${clientIp(request.headers)}`

  const limit = rateLimit(key, MAX_ATTEMPTS, WINDOW_MS)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  const session = checkPassword(scope, password)
  if (!session) {
    // El mensaje es deliberadamente genérico: no distingue entre contraseña
    // equivocada y variable de entorno sin configurar.
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  // Un login válido limpia el contador, para no castigar a quien se equivocó
  // un par de veces antes de acertar.
  resetRateLimit(key)

  const response = NextResponse.json({ ok: true })
  response.cookies.set(cookieName(scope), session, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  })
  return response
}
