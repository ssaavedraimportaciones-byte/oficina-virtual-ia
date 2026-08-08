import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requestPasswordReset } from '@/lib/auth'
import { clientIp, rateLimit } from '@/lib/rateLimit'

const schema = z.object({ email: z.string().email() })

/** Ventana laxa: es un formulario público, pero no hace falta que sea tan estricta como el login. */
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
  }

  const limit = await rateLimit(`forgot:${clientIp(request.headers)}`, MAX_ATTEMPTS, WINDOW_MS)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  // Nunca se distingue en la respuesta si el email existe o no: eso
  // permitiría enumerar cuentas probando direcciones una por una.
  await requestPasswordReset(parsed.data.email).catch((error) => {
    console.error('[forgot-password] error interno:', error)
  })

  return NextResponse.json({ ok: true })
}
