import { createHash } from 'crypto'

/**
 * Creates a SHA-256 fingerprint of a document's content at signing time.
 * Covers immutable fields so the hash changes if the document is altered
 * after the signature was applied.
 */
export function createSignatureHash(params: {
  documentId: string
  userId: string
  taskName: string
  workArea: string
  documentType: string
  signedAt: Date
  imageData: string
}): string {
  const payload = [
    params.documentId,
    params.userId,
    params.taskName,
    params.workArea,
    params.documentType,
    params.signedAt.toISOString(),
    // Hash of the signature image — don't embed the full data URL in the hash input
    createHash('sha256').update(params.imageData).digest('hex'),
  ].join('|')

  return createHash('sha256').update(payload).digest('hex')
}
