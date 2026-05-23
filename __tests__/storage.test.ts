import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { sanitizeStoragePath, parseDataUrl } from '@/lib/storage/types'
import { _resetProviderForTest, getStorageProvider } from '@/lib/storage'

describe('sanitizeStoragePath', () => {
  it('removes leading slashes', () => {
    expect(sanitizeStoragePath('/foo/bar.pdf')).toBe('foo/bar.pdf')
  })
  it('replaces path traversal with underscore', () => {
    const result = sanitizeStoragePath('../../etc/passwd')
    expect(result).not.toContain('..')
    expect(result).toContain('etc/passwd')
  })
  it('replaces backslashes with forward slashes', () => {
    expect(sanitizeStoragePath('foo\\bar\\baz.pdf')).toBe('foo/bar/baz.pdf')
  })
  it('allows alphanumeric, slashes, dots, dashes, underscores', () => {
    const p = 'documents/abc-123/scans/2024-file_v1.pdf'
    expect(sanitizeStoragePath(p)).toBe(p)
  })
  it('replaces disallowed chars with underscore', () => {
    expect(sanitizeStoragePath('foo bar@file!.pdf')).toBe('foo_bar_file_.pdf')
  })
})

describe('parseDataUrl', () => {
  it('parses valid PNG data URL', () => {
    const dataUrl = 'data:image/png;base64,aGVsbG8='
    const { contentType, buffer } = parseDataUrl(dataUrl)
    expect(contentType).toBe('image/png')
    expect(buffer.toString()).toBe('hello')
  })
  it('throws on invalid format', () => {
    expect(() => parseDataUrl('not-a-data-url')).toThrow('dataUrl inválido')
  })
  it('throws on empty string', () => {
    expect(() => parseDataUrl('')).toThrow('dataUrl inválido')
  })
  it('throws on base64 prefix without content type', () => {
    expect(() => parseDataUrl('data:;base64,aGVsbG8=')).toThrow('dataUrl inválido')
  })
})

describe('getStorageProvider — provider selection', () => {
  const originalEnv = process.env.STORAGE_PROVIDER

  beforeEach(() => {
    _resetProviderForTest()
  })

  afterEach(() => {
    process.env.STORAGE_PROVIDER = originalEnv
    _resetProviderForTest()
  })

  it('returns LocalStorageProvider when STORAGE_PROVIDER=local', () => {
    process.env.STORAGE_PROVIDER = 'local'
    const p = getStorageProvider()
    expect(p.constructor.name).toBe('LocalStorageProvider')
  })

  it('returns LocalStorageProvider when STORAGE_PROVIDER is unset', () => {
    delete process.env.STORAGE_PROVIDER
    const p = getStorageProvider()
    expect(p.constructor.name).toBe('LocalStorageProvider')
  })

  it('returns VercelBlobProvider when STORAGE_PROVIDER=vercel_blob', () => {
    process.env.STORAGE_PROVIDER = 'vercel_blob'
    const p = getStorageProvider()
    expect(p.constructor.name).toBe('VercelBlobProvider')
  })

  it('returns same singleton on repeated calls', () => {
    process.env.STORAGE_PROVIDER = 'local'
    const p1 = getStorageProvider()
    const p2 = getStorageProvider()
    expect(p1).toBe(p2)
  })
})

describe('LocalStorageProvider', () => {
  let provider: import('@/lib/storage/local').LocalStorageProvider

  beforeEach(async () => {
    const { LocalStorageProvider } = await import('@/lib/storage/local')
    const tmp = require('os').tmpdir() + '/safecheck-test-' + Date.now()
    process.env.UPLOAD_DIR = tmp
    process.env.UPLOAD_URL_PREFIX = '/uploads'
    provider = new LocalStorageProvider()
  })

  it('uploadBuffer saves file and returns correct URL', async () => {
    const buf = Buffer.from('test content')
    const result = await provider.uploadBuffer('test/hello.pdf', buf, 'application/pdf')
    expect(result.url).toBe('/uploads/test/hello.pdf')
    expect(result.path).toBe('test/hello.pdf')
  })

  it('uploadBase64Image parses data URL and saves', async () => {
    const dataUrl = 'data:image/png;base64,aGVsbG8='
    const result = await provider.uploadBase64Image('test/sig.png', dataUrl)
    expect(result.url).toContain('test/sig.png')
  })

  it('uploadBase64Image throws on invalid data URL', async () => {
    await expect(
      provider.uploadBase64Image('test/sig.png', 'invalid')
    ).rejects.toThrow('dataUrl inválido')
  })

  it('uploadBuffer sanitizes path traversal', async () => {
    const buf = Buffer.from('x')
    const result = await provider.uploadBuffer('../../etc/passwd', buf, 'text/plain')
    expect(result.path).not.toContain('..')
  })
})

describe('VercelBlobProvider', () => {
  it('uploadBuffer calls put with correct args and returns url', async () => {
    const mockPut = vi.fn().mockResolvedValue({ url: 'https://blob.vercel-storage.com/test.pdf' })
    vi.doMock('@vercel/blob', () => ({ put: mockPut }))

    const { VercelBlobProvider } = await import('@/lib/storage/vercel-blob')
    const provider = new VercelBlobProvider()
    const result = await provider.uploadBuffer('test/file.pdf', Buffer.from('x'), 'application/pdf')

    expect(mockPut).toHaveBeenCalledWith(
      'test/file.pdf',
      expect.any(Buffer),
      expect.objectContaining({ access: 'public', contentType: 'application/pdf' })
    )
    expect(result.url).toBe('https://blob.vercel-storage.com/test.pdf')

    vi.doUnmock('@vercel/blob')
  })

  it('uploadBase64Image throws on invalid data URL', async () => {
    const { VercelBlobProvider } = await import('@/lib/storage/vercel-blob')
    const provider = new VercelBlobProvider()
    await expect(
      provider.uploadBase64Image('test/sig.png', 'not-valid')
    ).rejects.toThrow('dataUrl inválido')
  })
})
