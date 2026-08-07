import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { changeOwnPassword, SESSION_COOKIE } from '@/lib/auth'
import { requireUser } from '@/lib/authz'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
})

export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (user instanceof NextResponse) return user

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Contraseña inválida (mínimo 8 caracteres)' }, { status: 400 })
  }

  // Middleware ya garantizó que esta cookie existe para llegar hasta acá.
  const currentToken = request.cookies.get(SESSION_COOKIE)!.value

  const result = await changeOwnPassword(
    user.id,
    parsed.data.currentPassword,
    parsed.data.newPassword,
    currentToken,
  )
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
