import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyEmailWithToken } from '@/lib/auth'

const schema = z.object({ token: z.string().min(1) })

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Falta el token.' }, { status: 400 })
  }

  const result = await verifyEmailWithToken(parsed.data.token)
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
