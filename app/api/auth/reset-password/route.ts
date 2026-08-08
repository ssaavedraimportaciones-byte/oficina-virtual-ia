import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resetPasswordWithToken } from '@/lib/auth'

const schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Contraseña inválida (mínimo 8 caracteres)' }, { status: 400 })
  }

  const result = await resetPasswordWithToken(parsed.data.token, parsed.data.newPassword)
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
