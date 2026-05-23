import { prisma } from '@/lib/db/client'
import { log } from '@/modules/audit'
import { canAccess } from '@/lib/permissions'
import { uploadBase64Image } from '@/lib/storage'
import { createSignatureHash, validateSignatureImage, hashSignatureImage, buildDocumentSnapshot, hashDocumentSnapshot } from './hash'
import type { SignaturePayload, SignatureValidation, SavedSignature, SigningMethod } from './types'
import type { UserRole } from '@/types/user'

export type { SignaturePayload, SignatureValidation, SavedSignature, SigningMethod }
export { createSignatureHash, validateSignatureImage, hashSignatureImage, buildDocumentSnapshot, hashDocumentSnapshot }

// ── captureSignature ──────────────────────────────────────────────────────────
/**
 * Validates a canvas signature PNG data URL and returns the decoded buffer.
 * Throws with a user-facing message if invalid.
 */
export function captureSignature(dataUrl: string): Buffer {
  return validateSignatureImage(dataUrl)
}

// ── validateSigner ────────────────────────────────────────────────────────────
export async function validateSigner(
  userId: string,
  role: UserRole,
  documentId: string
): Promise<SignatureValidation> {
  if (!canAccess(role, 'documents:sign')) {
    return { allowed: false, reason: `El rol "${role}" no tiene permiso para firmar documentos` }
  }

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { status: true },
  })

  if (!doc) {
    return { allowed: false, reason: 'Documento no encontrado' }
  }

  const immutable = ['APPROVED', 'CLOSED', 'ARCHIVED']
  if (immutable.includes(doc.status)) {
    return {
      allowed: false,
      reason: `No se puede firmar un documento en estado "${doc.status}"`,
    }
  }

  const existing = await prisma.signature.findUnique({
    where: { documentId_userId: { documentId, userId } },
    select: { id: true },
  })

  if (existing) {
    return { allowed: false, reason: 'Este usuario ya firmó el documento' }
  }

  return { allowed: true }
}

// ── saveSignature ─────────────────────────────────────────────────────────────
export async function saveSignature(payload: SignaturePayload): Promise<SavedSignature> {
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { name: true, role: true },
  })
  if (!user) throw new Error('Usuario no encontrado')

  const doc = await prisma.document.findUnique({
    where: { id: payload.documentId },
    select: { taskName: true, workArea: true, type: true },
  })
  if (!doc) throw new Error('Documento no encontrado')

  const signedAt = new Date()
  const hash = createSignatureHash({
    documentId: payload.documentId,
    userId: payload.userId,
    taskName: doc.taskName,
    workArea: doc.workArea,
    documentType: doc.type,
    signedAt,
    imageData: payload.imageData,
  })

  const methodMap: Record<SigningMethod, 'DIGITAL' | 'HANDWRITTEN' | 'BIOMETRIC'> = {
    CANVAS: 'DIGITAL',
    PIN: 'DIGITAL',
    QR: 'DIGITAL',
  }

  // Upload signature image to configured storage provider
  const sigPath = `documents/${payload.documentId}/signatures/${payload.userId}-${Date.now()}.png`
  const { url: signatureImageUrl } = await uploadBase64Image(sigPath, payload.imageData)

  const sig = await prisma.signature.create({
    data: {
      documentId: payload.documentId,
      userId: payload.userId,
      signatureImageUrl,
      method: methodMap[payload.method],
      gpsLat: payload.gpsLat,
      gpsLng: payload.gpsLng,
      signedAt,
      deviceInfo: {
        userAgent: payload.userAgent,
        ip: payload.ip,
        subMethod: payload.method,
        hash,
        signatureImageHash: payload.signatureImageHash,
        documentHashAtSigning: payload.documentHashAtSigning,
      },
    },
    include: { user: { select: { name: true, role: true } } },
  })

  return {
    id: sig.id,
    documentId: sig.documentId,
    userId: sig.userId,
    userName: sig.user.name,
    userRole: sig.user.role,
    signatureImageUrl: sig.signatureImageUrl,
    method: payload.method,
    signedAt: sig.signedAt.toISOString(),
    gpsLat: sig.gpsLat,
    gpsLng: sig.gpsLng,
    hash,
    signatureImageHash: payload.signatureImageHash,
    documentHashAtSigning: payload.documentHashAtSigning,
  }
}

// ── attachSignatureToDocument ─────────────────────────────────────────────────
export async function attachSignatureToDocument(
  documentId: string,
  _signatureId: string
): Promise<{ newStatus: string; signatureCount: number }> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { signatures: { select: { id: true } } },
  })
  if (!doc) throw new Error('Documento no encontrado')

  const signatureCount = doc.signatures.length
  const advanceable = ['DRAFT', 'SCANNED', 'AI_REVIEW', 'OBSERVED', 'PENDING_SIGNATURE']
  let newStatus = doc.status

  if (advanceable.includes(doc.status) && signatureCount >= 1) {
    newStatus = 'PENDING_APPROVAL'
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PENDING_APPROVAL' },
    })
  }

  return { newStatus, signatureCount }
}

// ── logSignatureMetadata ──────────────────────────────────────────────────────
export async function logSignatureMetadata(params: {
  userId: string
  documentId: string
  signatureId: string
  method: SigningMethod
  hash: string
  signatureImageHash: string
  documentHashAtSigning: string
  ip?: string
  userAgent?: string
  gpsLat?: number
  gpsLng?: number
  extraMetadata?: Record<string, unknown>
}): Promise<void> {
  await log(
    {
      userId: params.userId,
      ip: params.ip,
      userAgent: params.userAgent,
      gpsLat: params.gpsLat,
      gpsLng: params.gpsLng,
    },
    'DOCUMENT_SIGNED',
    {
      documentId: params.documentId,
      metadata: {
        signatureId: params.signatureId,
        method: params.method,
        hash: params.hash,
        signatureImageHash: params.signatureImageHash,
        documentHashAtSigning: params.documentHashAtSigning,
        after: { signatureCreated: true },
        ...params.extraMetadata,
      },
    }
  )
}
