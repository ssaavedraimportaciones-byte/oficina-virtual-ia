import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { requirePermission, requireAuth, getIp } from '@/app/api/_lib/auth-middleware'
import {
  validateSigner,
  saveSignature,
  attachSignatureToDocument,
  logSignatureMetadata,
} from '@/modules/signatures'
import type { SigningMethod } from '@/modules/signatures'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const QR_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'qr-signing-fallback-secret-32ch'
)

const postSchema = z.object({
  method: z.enum(['CANVAS', 'PIN', 'QR', 'CONFIRMED']),
  imageData: z.string().optional(),
  pin: z.string().optional(),
  qrToken: z.string().optional(),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
})

// ── GET /api/documents/[id]/signatures ────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req)
  if ('error' in auth) return auth.error

  const sigs = await prisma.signature.findMany({
    where: { documentId: params.id },
    orderBy: { signedAt: 'asc' },
    include: { user: { select: { name: true, role: true } } },
  })

  return NextResponse.json({
    signatures: sigs.map((s) => ({
      id: s.id,
      userId: s.userId,
      userName: s.user.name,
      userRole: s.user.role,
      method: (s.deviceInfo as Record<string, string> | null)?.subMethod ?? s.method,
      signedAt: s.signedAt.toISOString(),
      gpsLat: s.gpsLat,
      gpsLng: s.gpsLng,
      hash: (s.deviceInfo as Record<string, string> | null)?.hash ?? null,
    })),
  })
}

// ── POST /api/documents/[id]/signatures ───────────────────────────────────────

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requirePermission(req, 'documents:sign')
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }

  const { method, gpsLat, gpsLng } = parsed.data
  const ip = getIp(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  // ── Validate signer ────────────────────────────────────────────────────────
  const validation = await validateSigner(user.uid, user.role, params.id)
  if (!validation.allowed) {
    return NextResponse.json({ error: validation.reason }, { status: 403 })
  }

  // ── Method-specific auth ───────────────────────────────────────────────────
  let imageData: string

  if (method === 'CANVAS') {
    if (!parsed.data.imageData?.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Imagen de firma requerida para método canvas' }, { status: 400 })
    }
    imageData = parsed.data.imageData

  } else if (method === 'PIN') {
    if (!parsed.data.pin) {
      return NextResponse.json({ error: 'PIN requerido' }, { status: 400 })
    }
    const dbUser = await prisma.user.findUnique({
      where: { id: user.uid },
      select: { passwordHash: true },
    })
    if (!dbUser) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const pinOk = await bcrypt.compare(parsed.data.pin, dbUser.passwordHash)
    if (!pinOk) {
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
    }
    imageData = buildPinPlaceholder(user.name)

  } else if (method === 'QR') {
    if (!parsed.data.qrToken) {
      return NextResponse.json({ error: 'Token QR requerido' }, { status: 400 })
    }
    try {
      const { payload } = await jwtVerify(parsed.data.qrToken, QR_SECRET)
      if (payload.documentId !== params.id || payload.userId !== user.uid) {
        return NextResponse.json({ error: 'Token QR inválido para este documento/usuario' }, { status: 401 })
      }
    } catch {
      return NextResponse.json({ error: 'Token QR inválido o expirado' }, { status: 401 })
    }
    imageData = buildQrPlaceholder(user.name)

  } else {
    // CONFIRMED — logged-in user clicks "Confirmar firma"
    imageData = buildConfirmedPlaceholder(user.name)
  }

  // ── Save & attach ──────────────────────────────────────────────────────────
  const saved = await saveSignature({
    documentId: params.id,
    userId: user.uid,
    method: method as SigningMethod,
    imageData,
    ip,
    userAgent,
    gpsLat,
    gpsLng,
  })

  await attachSignatureToDocument(params.id, saved.id)

  await logSignatureMetadata({
    userId: user.uid,
    documentId: params.id,
    signatureId: saved.id,
    method: method as SigningMethod,
    hash: saved.hash,
    ip,
    userAgent,
    gpsLat,
    gpsLng,
  })

  return NextResponse.json({ ok: true, signature: saved }, { status: 201 })
}

// ── GET /api/documents/[id]/signatures/qr-token ────────────────────────────
// Exposed as a sub-path via a separate route file (see qr-token/route.ts).

// ── SVG placeholder builders ──────────────────────────────────────────────────

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function buildPinPlaceholder(name: string): string {
  return svgToDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80" viewBox="0 0 300 80">
      <rect width="300" height="80" fill="#1a1a2e"/>
      <text x="150" y="28" font-family="monospace" font-size="11" fill="#6b7280" text-anchor="middle">Firma verificada por PIN</text>
      <text x="150" y="56" font-family="serif" font-size="22" fill="#e5e7eb" text-anchor="middle" font-style="italic">${escSvg(name)}</text>
    </svg>`
  )
}

function buildQrPlaceholder(name: string): string {
  return svgToDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80" viewBox="0 0 300 80">
      <rect width="300" height="80" fill="#0f172a"/>
      <text x="150" y="28" font-family="monospace" font-size="11" fill="#6b7280" text-anchor="middle">Firma verificada por QR</text>
      <text x="150" y="56" font-family="serif" font-size="22" fill="#e5e7eb" text-anchor="middle" font-style="italic">${escSvg(name)}</text>
    </svg>`
  )
}

function buildConfirmedPlaceholder(name: string): string {
  return svgToDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80" viewBox="0 0 300 80">
      <rect width="300" height="80" fill="#052e16"/>
      <text x="150" y="28" font-family="monospace" font-size="11" fill="#6b7280" text-anchor="middle">Firma electrónica confirmada</text>
      <text x="150" y="56" font-family="serif" font-size="22" fill="#e5e7eb" text-anchor="middle" font-style="italic">${escSvg(name)}</text>
    </svg>`
  )
}

function escSvg(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export { QR_SECRET }
