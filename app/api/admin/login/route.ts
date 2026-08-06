import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ADMIN_COOKIE, checkPassword } from '@/lib/adminAuth'

const schema = z.object({ password: z.string().min(1) })

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Contraseña requerida' }, { status: 400 })
  }

  const session = checkPassword(parsed.data.password)
  if (!session) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_COOKIE, session, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(ADMIN_COOKIE)
  return response
}
