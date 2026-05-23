import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { generateMfaSecret, generateOtpAuthUri, generateBackupCodes } from '@/lib/mfa'
import { toDataURL } from 'qrcode'
import { log } from '@/modules/audit'

// POST /api/auth/mfa/setup — genera secret + QR para enrollment
// Requiere autenticación (x-user-id del middleware)
export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, mfaEnabled: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.mfaEnabled) return NextResponse.json({ error: 'MFA already enabled' }, { status: 409 })

  const secret = generateMfaSecret()
  const otpUri = generateOtpAuthUri(secret, user.email)
  const qrDataUrl = await toDataURL(otpUri)
  const backupCodes = generateBackupCodes(8)

  // Store pending secret — not enabled until confirmed
  await prisma.user.update({
    where: { id: userId },
    data: { mfaSecret: secret, mfaBackupCodes: backupCodes },
  })

  await log(
    { userId, ip: req.headers.get('x-forwarded-for') ?? '', userAgent: req.headers.get('user-agent') ?? '' },
    'MFA_SETUP_INITIATED',
    {}
  )

  return NextResponse.json({ qrDataUrl, backupCodes })
}
