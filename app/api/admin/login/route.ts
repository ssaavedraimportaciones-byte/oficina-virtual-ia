import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPassword, cookieName } from '@/lib/adminAuth'

const schema = z.object({
  password: z.string().min(1),
  scope: z.enum(['admin', 'panel']).default('admin'),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Contraseña requerida' }, { status: 400 })
  }

  const { scope, password } = parsed.data
  const session = checkPassword(scope, password)
  if (!session) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

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
