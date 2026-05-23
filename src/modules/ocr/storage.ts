import type { UploadedFile } from './types'
import { uploadBuffer } from '@/lib/storage'

export async function storeFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  documentId: string
): Promise<UploadedFile> {
  const ext = mimeToExt(mimeType)
  const timestamp = Date.now()
  const storagePath = `documents/${documentId}/scans/${timestamp}-original${ext}`

  const result = await uploadBuffer(storagePath, buffer, mimeType)

  return {
    originalName,
    storagePath: result.path,
    storageUrl: result.url,
    mimeType,
    sizeBytes: buffer.length,
  }
}

export async function readFile(storagePath: string): Promise<Buffer> {
  if (process.env.STORAGE_PROVIDER === 'vercel_blob') {
    const res = await fetch(storagePath)
    if (!res.ok) throw new Error(`storage: no se pudo leer el archivo (${res.status})`)
    return Buffer.from(await res.arrayBuffer())
  }
  const { promises: fs } = await import('fs')
  return fs.readFile(storagePath)
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/tiff': '.tiff',
    'image/heic': '.heic',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
  }
  return map[mime] ?? '.bin'
}

export const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
])

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
