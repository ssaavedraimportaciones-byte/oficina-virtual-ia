import { NextResponse } from 'next/server'
import { sendVerificationEmail } from '@/lib/auth'
import { requireUser } from '@/lib/authz'
import { rateLimit } from '@/lib/rateLimit'

const MAX_ATTEMPTS = 3
const WINDOW_MS = 15 * 60 * 1000

export async function POST(request: Request) {
  const user = await requireUser()
  if (user instanceof NextResponse) return user

  const limit = await rateLimit(`resend-verify:${user.id}`, MAX_ATTEMPTS, WINDOW_MS)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Ya se envió un mail hace poco. Esperá unos minutos.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  await sendVerificationEmail(user.id)
  return NextResponse.json({ ok: true })
}
