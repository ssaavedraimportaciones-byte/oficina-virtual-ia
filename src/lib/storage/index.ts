import type { StorageProvider, StorageResult } from './types'
import { LocalStorageProvider } from './local'
import { VercelBlobProvider } from './vercel-blob'
export type { StorageResult, StorageProvider }
export { sanitizeStoragePath } from './types'

let _provider: StorageProvider | null = null

export function getStorageProvider(): StorageProvider {
  if (_provider) return _provider
  const p = process.env.STORAGE_PROVIDER ?? 'local'
  _provider = p === 'vercel_blob' ? new VercelBlobProvider() : new LocalStorageProvider()
  return _provider
}

export function uploadBuffer(
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<StorageResult> {
  return getStorageProvider().uploadBuffer(storagePath, buffer, contentType)
}

export function uploadBase64Image(
  storagePath: string,
  dataUrl: string
): Promise<StorageResult> {
  return getStorageProvider().uploadBase64Image(storagePath, dataUrl)
}

// visible for testing
export function _resetProviderForTest(): void {
  _provider = null
}
