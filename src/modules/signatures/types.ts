export type SigningMethod = 'CANVAS' | 'PIN' | 'QR' | 'CONFIRMED'

export interface SignaturePayload {
  documentId: string
  userId: string
  method: SigningMethod
  /** Base-64 PNG data URL (canvas) or stored image URL (HANDWRITTEN) */
  imageData: string
  ip?: string
  userAgent?: string
  gpsLat?: number
  gpsLng?: number
}

export interface SignatureValidation {
  allowed: boolean
  reason?: string
}

export interface SavedSignature {
  id: string
  documentId: string
  userId: string
  userName: string
  userRole: string
  signatureImageUrl: string
  method: string
  signedAt: string
  gpsLat: number | null
  gpsLng: number | null
  hash: string
}

export interface QRSignToken {
  documentId: string
  userId: string
  exp: number
}
