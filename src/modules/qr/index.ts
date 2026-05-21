import { createHmac, createHash } from 'crypto'
import QRCode from 'qrcode'

const QR_SECRET = process.env.JWT_SECRET ?? 'qr-verify-fallback-secret-min-32ch'

/**
 * Generates the stable QR code identifier for a document.
 * HMAC-SHA256 so it can't be forged and changes if key inputs change.
 */
export function generateQrCode(params: {
  documentId: string
  folio: string
  approvedAt: string
}): string {
  const payload = `${params.documentId}|${params.folio}|${params.approvedAt}`
  return createHmac('sha256', QR_SECRET).update(payload).digest('hex')
}

/**
 * Creates a SHA-256 content hash of the document's immutable fields.
 * Any change to these fields invalidates the hash and requires a new version.
 */
export function createDocumentHash(params: {
  documentId: string
  folio: string
  taskName: string
  workArea: string
  documentType: string
  approvedAt: string
}): string {
  const payload = [
    params.documentId,
    params.folio,
    params.taskName,
    params.workArea,
    params.documentType,
    params.approvedAt,
  ].join('|')
  return createHash('sha256').update(payload).digest('hex')
}

/**
 * Generates the public verification URL embedded in the QR code.
 */
export function buildVerifyUrl(qrCode: string): string {
  const base = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'
  return `${base}/verify/${qrCode}`
}

/**
 * Renders a QR code PNG as a Base-64 data URL pointing to the verification page.
 */
export async function generateQrDataUrl(qrCode: string): Promise<string> {
  const url = buildVerifyUrl(qrCode)
  return QRCode.toDataURL(url, {
    width: 200,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })
}
