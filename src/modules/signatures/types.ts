export type SigningMethod = 'CANVAS' | 'PIN' | 'QR'

export interface SignaturePayload {
  documentId: string
  userId: string
  method: SigningMethod
  /** PNG data URL — always a real canvas capture */
  imageData: string
  signatureImageHash: string
  documentHashAtSigning: string
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
  signatureImageHash: string
  documentHashAtSigning: string
}

export interface QRSignToken {
  documentId: string
  userId: string
  exp: number
}
