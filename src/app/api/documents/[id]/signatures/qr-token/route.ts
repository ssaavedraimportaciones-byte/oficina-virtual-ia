import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/app/api/_lib/auth-middleware'
import { SignJWT } from 'jose'
import { QR_SECRET as QR_SECRET_RAW } from '@/lib/env'
import { TextEncoder } from 'util'

const QR_SECRET = new TextEncoder().encode(QR_SECRET_RAW)

/**
 * POST /api/documents/[id]/signatures/qr-token
 * Issues a 15-minute JWT that the worker scans via QR code to sign the document.
 * The token is tied to this documentId + userId and expires quickly.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = requirePermission(req, 'documents:sign')
  if ('error' in auth) return auth.error
  const { user } = auth

  const token = await new SignJWT({ documentId: id, userId: user.uid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(QR_SECRET)

  return NextResponse.json({ token, expiresIn: 900 })
}
