import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { verifyTotpToken, verifyBackupCode } from '@/lib/mfa'
import { log } from '@/modules/audit'
import { z } from 'zod'

const schema = z.object({
  token: z.string().optional(),
  backupCode: z.string().optional(),
}).refine((d) => d.token ?? d.backupCode, { message: 'Provide token or backupCode' })

// POST /api/auth/mfa/disable — desactiva MFA (requiere TOTP o backup code)
export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, mfaEnabled: true, mfaSecret: true, mfaBackupCodes: true },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!user.mfaEnabled) return NextResponse.json({ error: 'MFA not enabled' }, { status: 400 })
  if (user.role === 'SYSTEM_ADMIN') {
    return NextResponse.json({ error: 'SYSTEM_ADMIN no puede desactivar MFA' }, { status: 403 })
  }

  const ip = req.headers.get('x-forwarded-for') ?? ''
  const userAgent = req.headers.get('user-agent') ?? ''

  let valid = false
  if (parsed.data.token && user.mfaSecret) {
    valid = await verifyTotpToken(parsed.data.token, user.mfaSecret)
  } else if (parsed.data.backupCode) {
    const result = verifyBackupCode(parsed.data.backupCode, user.mfaBackupCodes)
    valid = result.valid
    if (valid) {
      await prisma.user.update({ where: { id: userId }, data: { mfaBackupCodes: result.remaining } })
    }
  }

  if (!valid) {
    await log({ userId, ip, userAgent }, 'MFA_DISABLE_FAILED', {})
    return NextResponse.json({ error: 'Código incorrecto' }, { status: 401 })
  }

  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] },
  })
  await log({ userId, ip, userAgent }, 'MFA_DISABLED', {})
  return NextResponse.json({ ok: true })
}
