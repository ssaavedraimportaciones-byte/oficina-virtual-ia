import { promises as fs } from 'fs'
import path from 'path'
import type { UploadedFile } from './types'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
const UPLOAD_URL_PREFIX = process.env.UPLOAD_URL_PREFIX ?? '/uploads'

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

export async function storeFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  documentId: string
): Promise<UploadedFile> {
  const ext = path.extname(originalName) || mimeToExt(mimeType)
  const timestamp = Date.now()
  const filename = `${documentId}-${timestamp}-original${ext}`

  if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
    return storeAzureBlob(buffer, filename, originalName, mimeType)
  }

  await ensureDir(UPLOAD_DIR)
  const fullPath = path.join(UPLOAD_DIR, filename)
  await fs.writeFile(fullPath, buffer)

  return {
    originalName,
    storagePath: fullPath,
    storageUrl: `${UPLOAD_URL_PREFIX}/${filename}`,
    mimeType,
    sizeBytes: buffer.length,
  }
}

export async function readFile(storagePath: string): Promise<Buffer> {
  return fs.readFile(storagePath)
}

async function storeAzureBlob(
  buffer: Buffer,
  filename: string,
  originalName: string,
  mimeType: string
): Promise<UploadedFile> {
  // Dynamic import so the package is optional — only needed when Azure env vars are set
  const { BlobServiceClient } = await import('@azure/storage-blob')

  const client = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING!
  )
  const container = client.getContainerClient(
    process.env.AZURE_STORAGE_CONTAINER ?? 'safecheck-docs'
  )
  await container.createIfNotExists({ access: 'none' })

  const blob = container.getBlockBlobClient(filename)
  await blob.upload(buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: mimeType },
  })

  return {
    originalName,
    storagePath: blob.name,
    storageUrl: blob.url,
    mimeType,
    sizeBytes: buffer.length,
  }
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
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/heic',
  'image/webp',
  'application/pdf',
])

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB
