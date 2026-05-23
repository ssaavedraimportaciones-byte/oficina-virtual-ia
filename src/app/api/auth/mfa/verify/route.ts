import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { verifyTotpToken } from '@/lib/mfa'
import { log } from '@/modules/audit'
import { z } from 'zod'

const schema = z.object({ token: z.string().length(6).regex(/^\d{6}$/) })

// POST /api/auth/mfa/verify — confirma enrollment o valida 2FA en login
// Body: { token: "123456" }
// Header x-mfa-pending-user-id: usado en el flujo de login de 2 pasos
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Token inválido — debe ser 6 dígitos' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for') ?? ''
  const userAgent = req.headers.get('user-agent') ?? ''

  // Two flows: enrollment confirmation (userId from session) or login 2FA (userId from temp header)
  const sessionUserId = req.headers.get('x-user-id')
  const pendingUserId = req.headers.get('x-mfa-pending-user-id')
  const userId = sessionUserId ?? pendingUserId
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, mfaEnabled: true, mfaSecret: true },
  })
  if (!user || !user.mfaSecret) {
    return NextResponse.json({ error: 'MFA not configured' }, { status: 400 })
  }

  const valid = await verifyTotpToken(parsed.data.token, user.mfaSecret)
  if (!valid) {
    await log({ userId, ip, userAgent }, 'MFA_VERIFY_FAILED', {})
    return NextResponse.json({ error: 'Código incorrecto' }, { status: 401 })
  }

  // If this is enrollment confirmation, enable MFA
  if (!user.mfaEnabled) {
    await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } })
    await log({ userId, ip, userAgent }, 'MFA_ENABLED', {})
    return NextResponse.json({ ok: true, message: 'MFA activado correctamente' })
  }

  // Login 2FA: return ok (caller issues JWT)
  await log({ userId, ip, userAgent }, 'MFA_VERIFY_OK', {})
  return NextResponse.json({ ok: true })
}
