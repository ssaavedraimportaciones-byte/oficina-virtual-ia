export interface StorageResult {
  url: string
  path: string
}

export interface StorageProvider {
  uploadBuffer(storagePath: string, buffer: Buffer, contentType: string): Promise<StorageResult>
  uploadBase64Image(storagePath: string, dataUrl: string): Promise<StorageResult>
}

export function parseDataUrl(dataUrl: string): { contentType: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) throw new Error('storage: dataUrl inválido — formato esperado: data:<type>;base64,<data>')
  return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') }
}

export function sanitizeStoragePath(p: string): string {
  return p
    .replace(/\\/g, '/')
    .replace(/\.{2,}/g, '_')
    .replace(/[^a-zA-Z0-9/_.\-]/g, '_')
    .replace(/^\/+/, '')
}
