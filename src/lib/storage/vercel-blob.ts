import type { StorageProvider, StorageResult } from './types'
import { parseDataUrl, sanitizeStoragePath } from './types'
import { SignJWT } from 'jose'

// Default signed-URL expiry: 15 minutes
const DEFAULT_SIGNED_URL_TTL = 60 * 15

export class VercelBlobProvider implements StorageProvider {
  async uploadBuffer(storagePath: string, buffer: Buffer, contentType: string): Promise<StorageResult> {
    const { put } = await import('@vercel/blob')
    const safe = sanitizeStoragePath(storagePath)
    const blob = await put(safe, buffer, {
      access: 'public',
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return { url: blob.url, path: safe }
  }

  async uploadBase64Image(storagePath: string, dataUrl: string): Promise<StorageResult> {
    const { contentType, buffer } = parseDataUrl(dataUrl)
    return this.uploadBuffer(storagePath, buffer, contentType)
  }

  // Vercel Blob does not natively support signed private URLs from the SDK.
  // We generate a short-lived signed JWT that our /api/storage/signed-url route
  // validates before proxying the blob download.
  async getSignedUrl(storagePath: string, expiresInSeconds = DEFAULT_SIGNED_URL_TTL): Promise<string> {
    const { QR_SECRET } = await import('@/lib/env')
    const safe = sanitizeStoragePath(storagePath)
    const secret = new TextEncoder().encode(QR_SECRET)
    const token = await new SignJWT({ path: safe })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
      .sign(secret)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    return `${appUrl}/api/storage/signed-url?token=${encodeURIComponent(token)}`
  }
}

