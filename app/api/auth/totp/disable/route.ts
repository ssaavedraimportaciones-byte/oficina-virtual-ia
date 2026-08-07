import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { disableTotp } from '@/lib/auth'
import { requireUser } from '@/lib/authz'

const schema = z.object({ code: z.string().min(1) })

export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (user instanceof NextResponse) return user

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Falta el código.' }, { status: 400 })
  }

  const result = await disableTotp(user.id, parsed.data.code)
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
