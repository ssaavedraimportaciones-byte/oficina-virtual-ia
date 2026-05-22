import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { requirePermission, requireAuth, getIp } from '@/app/api/_lib/auth-middleware'
import {
  validateSigner,
  saveSignature,
  attachSignatureToDocument,
  logSignatureMetadata,
  validateSignatureImage,
  hashSignatureImage,
  buildDocumentSnapshot,
  hashDocumentSnapshot,
} from '@/modules/signatures'
import type { SigningMethod } from '@/modules/signatures'
import { log } from '@/modules/audit'
import { notify } from '@/modules/notifications'
import {
  validateDocumentGeofence,
  createGeofenceAuditMetadata,
} from '@/modules/geofence'
import bcrypt from 'bcryptjs'
import { jwtVerify } from 'jose'
import { JWT_SECRET } from '@/lib/env'

const QR_SECRET = new TextEncoder().encode(JWT_SECRET)

const postSchema = z.object({
  method: z.enum(['CANVAS', 'PIN', 'QR']),
  signatureImageBase64: z.string().min(1, 'La imagen de firma es obligatoria'),
  pin: z.string().optional(),
  qrToken: z.string().optional(),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
})

// ── GET /api/documents/[id]/signatures ────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = requireAuth(req)
  if ('error' in auth) return auth.error

  const sigs = await prisma.signature.findMany({
    where: { documentId: id },
    orderBy: { signedAt: 'asc' },
    include: { user: { select: { name: true, role: true } } },
  })

  return NextResponse.json({
    signatures: sigs.map((s) => {
      const di = (s.deviceInfo as Record<string, string> | null) ?? {}
      return {
        id: s.id,
        userId: s.userId,
        userName: s.user.name,
        userRole: s.user.role,
        method: di.subMethod ?? s.method,
        signedAt: s.signedAt.toISOString(),
        gpsLat: s.gpsLat,
        gpsLng: s.gpsLng,
        hash: di.hash ?? null,
        signatureImageHash: di.signatureImageHash ?? null,
        documentHashAtSigning: di.documentHashAtSigning ?? null,
        signatureImageUrl: s.signatureImageUrl,
      }
    }),
  })
}

// ── POST /api/documents/[id]/signatures ───────────────────────────────────────

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = requirePermission(req, 'documents:sign')
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }

  const { method, signatureImageBase64, gpsLat, gpsLng } = parsed.data
  const ip = getIp(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  // ── 1. Validate signer ─────────────────────────────────────────────────────
  const validation = await validateSigner(user.uid, user.role, id)
  if (!validation.allowed) {
    return NextResponse.json({ error: validation.reason }, { status: 403 })
  }

  // ── 2. Validate canvas image (same for ALL methods) ────────────────────────
  let imageBuffer: Buffer
  try {
    imageBuffer = validateSignatureImage(signatureImageBase64)
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Imagen inválida'
    await log(
      { userId: user.uid, ip, userAgent, gpsLat, gpsLng },
      'DOCUMENT_SIGNED',
      {
        documentId: id,
        metadata: { blocked: true, reason: 'missing_canvas_signature', method, detail: reason },
      }
    )
    return NextResponse.json({ error: reason }, { status: 400 })
  }

  const signatureImageHash = hashSignatureImage(imageBuffer)

  // ── 3. Method-specific credential validation ───────────────────────────────
  if (method === 'PIN') {
    if (!parsed.data.pin) {
      return NextResponse.json({ error: 'PIN requerido para método PIN' }, { status: 400 })
    }
    const dbUser = await prisma.user.findUnique({
      where: { id: user.uid },
      select: { passwordHash: true },
    })
    if (!dbUser) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const pinOk = await bcrypt.compare(parsed.data.pin, dbUser.passwordHash)
    if (!pinOk) {
      await log(
        { userId: user.uid, ip, userAgent, gpsLat, gpsLng },
        'DOCUMENT_SIGNED',
        {
          documentId: id,
          metadata: { blocked: true, reason: 'invalid_pin', method },
        }
      )
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
    }
  }

  if (method === 'QR') {
    if (!parsed.data.qrToken) {
      return NextResponse.json({ error: 'Token QR requerido para método QR' }, { status: 400 })
    }
    try {
      const { payload } = await jwtVerify(parsed.data.qrToken, QR_SECRET)
      if (payload.documentId !== id || payload.userId !== user.uid) {
        throw new Error('Token no coincide con documento/usuario')
      }
    } catch {
      await log(
        { userId: user.uid, ip, userAgent, gpsLat, gpsLng },
        'DOCUMENT_SIGNED',
        {
          documentId: id,
          metadata: { blocked: true, reason: 'invalid_qr', method },
        }
      )
      return NextResponse.json({ error: 'Token QR inválido o expirado' }, { status: 401 })
    }
  }

  // ── 4. Build document snapshot hash ───────────────────────────────────────
  const docSnap = await prisma.document.findUnique({
    where: { id: id },
    select: {
      id: true,
      folio: true,
      type: true,
      status: true,
      taskName: true,
      workArea: true,
      companyId: true,
      createdById: true,
      geofenceLat: true,
      geofenceLng: true,
      geofenceRadiusMeters: true,
      fields: {
        select: { fieldName: true, fieldValue: true },
        orderBy: { fieldName: 'asc' },
      },
    },
  })
  if (!docSnap) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  const snapshot = buildDocumentSnapshot(docSnap)
  const documentHashAtSigning = hashDocumentSnapshot(snapshot)

  // ── 4.5. Geofence validation ───────────────────────────────────────────────
  const gpsPoint =
    gpsLat != null && gpsLng != null ? { lat: gpsLat, lng: gpsLng } : null

  const geofenceResult = validateDocumentGeofence(docSnap, gpsPoint)
  const geofenceAuditMeta = createGeofenceAuditMetadata(geofenceResult, gpsPoint)

  if (!geofenceResult.ok) {
    await log(
      { userId: user.uid, ip, userAgent, gpsLat, gpsLng },
      'DOCUMENT_SIGNED',
      {
        documentId: id,
        metadata: {
          blocked: true,
          reason: geofenceResult.reason,
          method,
          ...geofenceAuditMeta,
        },
      }
    )
    return NextResponse.json({ error: geofenceResult.errorMessage }, { status: 422 })
  }

  // ── 5. Save & audit ────────────────────────────────────────────────────────
  const saved = await saveSignature({
    documentId: id,
    userId: user.uid,
    method: method as SigningMethod,
    imageData: signatureImageBase64,
    signatureImageHash,
    documentHashAtSigning,
    ip,
    userAgent,
    gpsLat,
    gpsLng,
  })

  await attachSignatureToDocument(id, saved.id)

  await logSignatureMetadata({
    userId: user.uid,
    documentId: id,
    signatureId: saved.id,
    method: method as SigningMethod,
    hash: saved.hash,
    signatureImageHash,
    documentHashAtSigning,
    ip,
    userAgent,
    gpsLat,
    gpsLng,
    extraMetadata: geofenceAuditMeta,
  })

  // Notify — fire-and-forget
  const [signer, doc] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.uid }, select: { name: true } }),
    prisma.document.findUnique({
      where: { id: id },
      select: { folio: true, taskName: true, workArea: true },
    }),
  ])
  if (doc) {
    notify(
      {
        event: 'DOCUMENT_PENDING_SIGNATURE',
        documentId: id,
        folio: doc.folio,
        taskName: doc.taskName,
        workArea: doc.workArea,
        initiatorName: signer?.name ?? 'Firmante',
      },
      { excludeIds: [user.uid], auditCtx: { userId: user.uid, ip, userAgent } }
    ).catch((err) => console.error('[notifications] DOCUMENT_PENDING_SIGNATURE failed:', err))
  }

  return NextResponse.json({ ok: true, signature: saved }, { status: 201 })
}

export { QR_SECRET }
