import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSession, ensureBootstrapAdmin, SESSION_COOKIE, verifyPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { clientIp, rateLimit, resetRateLimit } from '@/lib/rateLimit'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

/** Ventana de fuerza bruta: 8 intentos fallidos cada 15 minutos por IP. */
const MAX_ATTEMPTS = 8
const WINDOW_MS = 15 * 60 * 1000

export async function POST(request: NextRequest) {
  // Barato de llamar siempre: solo inserta si la tabla de usuarios está
  // vacía, así el primer deploy puede entrar sin insertar filas a mano.
  await ensureBootstrapAdmin()

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
  }

  const { email, password } = parsed.data
  const key = `login:${clientIp(request.headers)}`

  const limit = await rateLimit(key, MAX_ATTEMPTS, WINDOW_MS)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

  // El mismo mensaje genérico tanto si el email no existe como si la
  // contraseña está mal: no le confirma a un atacante qué emails son válidos.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
  }

  await resetRateLimit(key)

  const token = await createSession(user.id)

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
