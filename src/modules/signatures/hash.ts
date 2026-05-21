import { createHash } from 'crypto'

/**
 * Validates a Base64 PNG data URL submitted as a signature image.
 * Throws with a user-facing message if any check fails.
 * Returns the decoded Buffer on success.
 */
export function validateSignatureImage(dataUrl: string): Buffer {
  if (!dataUrl.startsWith('data:image/png;base64,')) {
    throw new Error('La imagen de firma debe ser PNG (data:image/png;base64,...). SVG no permitido.')
  }

  const b64 = dataUrl.slice('data:image/png;base64,'.length)

  if (!b64 || b64.length < 20) {
    throw new Error('La imagen de firma está vacía')
  }

  // Decoded max ~375 KB — more than enough for a canvas signature
  if (b64.length > 512_000) {
    throw new Error('La imagen de firma supera el tamaño máximo permitido (375 KB)')
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(b64, 'base64')
  } catch {
    throw new Error('La imagen de firma contiene datos base64 inválidos')
  }

  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (buffer.length < 8 || !PNG.every((b, i) => buffer[i] === b)) {
    throw new Error('La imagen de firma no es un PNG válido (magic bytes incorrectos)')
  }

  return buffer
}

/**
 * SHA-256 hex of the raw image buffer.
 * Stored separately from the composite signature hash so the image
 * can be re-verified independently in the future.
 */
export function hashSignatureImage(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Builds a deterministic JSON snapshot of the document state at signing time.
 * Fields are sorted so the output is stable regardless of insertion order.
 */
export function buildDocumentSnapshot(doc: {
  id: string
  folio: string
  type: string
  status: string
  taskName: string
  workArea: string
  companyId: string
  createdById: string
  fields: { fieldName: string; fieldValue: string | null }[]
}): string {
  return JSON.stringify({
    documentId: doc.id,
    folio: doc.folio,
    type: doc.type,
    status: doc.status,
    taskName: doc.taskName,
    workArea: doc.workArea,
    companyId: doc.companyId,
    createdById: doc.createdById,
    fields: [...doc.fields]
      .sort((a, b) => a.fieldName.localeCompare(b.fieldName))
      .map((f) => ({ name: f.fieldName, value: f.fieldValue ?? '' })),
  })
}

/** SHA-256 hex of the document snapshot string. */
export function hashDocumentSnapshot(snapshot: string): string {
  return createHash('sha256').update(snapshot).digest('hex')
}

/**
 * Composite SHA-256 fingerprint of the full signing context.
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
    createHash('sha256').update(params.imageData).digest('hex'),
  ].join('|')

  return createHash('sha256').update(payload).digest('hex')
}
