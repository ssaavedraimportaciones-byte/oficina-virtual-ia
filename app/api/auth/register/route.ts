import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSession, createUser, ensureBootstrapAdmin, SESSION_COOKIE } from '@/lib/auth'
import { clientIp, rateLimit } from '@/lib/rateLimit'
import { signupOpen } from '@/lib/signup'

const schema = z.object({
  email: z.string().trim().email('Ese email no parece válido').max(200),
  // El tope de largo evita que alguien mande una contraseña gigante para
  // gastar CPU en el hash.
  password: z.string().min(8, 'La contraseña necesita al menos 8 caracteres').max(128),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Tienes que aceptar los términos y la política de privacidad' }),
  }),
})

/** Registros por IP y hora: frena el alta masiva de cuentas. */
const MAX_SIGNUPS = 5
const WINDOW_MS = 60 * 60 * 1000

export async function POST(request: NextRequest) {
  if (!signupOpen()) {
    return NextResponse.json({ error: 'El registro está cerrado por ahora.' }, { status: 403 })
  }

  const limit = await rateLimit(`register:${clientIp(request.headers)}`, MAX_SIGNUPS, WINDOW_MS)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Demasiados registros desde esta conexión. Prueba de nuevo más tarde.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }

  // Si el primero en llegar a una base vacía es un registro, el administrador
  // de plataforma igual tiene que crearse: el login lo hace al entrar, pero acá
  // nadie pasó por el login todavía.
  await ensureBootstrapAdmin()

  const created = await createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    role: 'USER',
    termsAcceptedAt: new Date(),
  })
  if (!created.ok) {
    return NextResponse.json(
      { error: 'No se pudo crear la cuenta con ese email. Si ya tienes una, ingresa o recupera tu contraseña.' },
      { status: 409 },
    )
  }

  const token = await createSession(created.id, {
    ipAddress: clientIp(request.headers),
    userAgent: request.headers.get('user-agent'),
  })
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}
