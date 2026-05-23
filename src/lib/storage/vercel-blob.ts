import type { StorageProvider, StorageResult } from './types'
import { parseDataUrl, sanitizeStoragePath } from './types'

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
}
