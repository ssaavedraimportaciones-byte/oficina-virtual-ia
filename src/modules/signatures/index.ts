import { prisma } from '@/lib/db/client'
import { log } from '@/modules/audit'
import { canAccess } from '@/lib/permissions'
import { createSignatureHash } from './hash'
import type { SignaturePayload, SignatureValidation, SavedSignature, SigningMethod } from './types'
import type { UserRole } from '@/types/user'

export type { SignaturePayload, SignatureValidation, SavedSignature, SigningMethod }
export { createSignatureHash }

// ── captureSignature ──────────────────────────────────────────────────────────
/**
 * Validates a canvas signature image (Base64 PNG data URL).
 * Returns the data URL as-is; persistence is done by saveSignature().
 */
export function captureSignature(dataUrl: string): string {
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('La imagen de firma debe ser un data URL de imagen válido')
  }
  return dataUrl
}

// ── validateSigner ────────────────────────────────────────────────────────────
/**
 * Checks whether a user is allowed to sign a given document.
 * Blocks if: no permission, document is immutable, or user already signed.
 */
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
/**
 * Stores a validated signature record. imageData is a Base64 PNG data URL
 * for canvas/confirmed methods; PIN and QR receive a server-generated placeholder.
 */
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
    CONFIRMED: 'DIGITAL',
  }

  const sig = await prisma.signature.create({
    data: {
      documentId: payload.documentId,
      userId: payload.userId,
      signatureImageUrl: payload.imageData,
      method: methodMap[payload.method],
      gpsLat: payload.gpsLat,
      gpsLng: payload.gpsLng,
      signedAt,
      deviceInfo: {
        userAgent: payload.userAgent,
        ip: payload.ip,
        subMethod: payload.method,
        hash,
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
  }
}

// ── attachSignatureToDocument ─────────────────────────────────────────────────
/**
 * After a signature is saved, advances the document to PENDING_APPROVAL
 * if at least one signature is present and the document is in a signable state.
 */
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
/**
 * Writes an immutable AuditLog entry for a signature event.
 */
export async function logSignatureMetadata(params: {
  userId: string
  documentId: string
  signatureId: string
  method: SigningMethod
  hash: string
  ip?: string
  userAgent?: string
  gpsLat?: number
  gpsLng?: number
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
      },
    }
  )
}
