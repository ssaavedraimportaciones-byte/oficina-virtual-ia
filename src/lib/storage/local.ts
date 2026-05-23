import { promises as fs } from 'fs'
import path from 'path'
import type { StorageProvider, StorageResult } from './types'
import { parseDataUrl, sanitizeStoragePath } from './types'

export class LocalStorageProvider implements StorageProvider {
  private readonly uploadDir: string
  private readonly urlPrefix: string

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
    this.urlPrefix = process.env.UPLOAD_URL_PREFIX ?? '/uploads'
  }

  async uploadBuffer(storagePath: string, buffer: Buffer, _contentType: string): Promise<StorageResult> {
    const safe = sanitizeStoragePath(storagePath)
    const fullPath = path.join(this.uploadDir, safe)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, buffer)
    return { url: `${this.urlPrefix}/${safe}`, path: safe }
  }

  async uploadBase64Image(storagePath: string, dataUrl: string): Promise<StorageResult> {
    const { buffer, contentType } = parseDataUrl(dataUrl)
    return this.uploadBuffer(storagePath, buffer, contentType)
  }
}
