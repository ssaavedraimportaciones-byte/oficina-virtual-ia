import { describe, it, expect } from 'vitest'
import {
  detectFileTypeByMagicBytes,
  validateAllowedUpload,
  assertAllowedUpload,
  getAllowedFileTypes,
  FileValidationError,
} from '@/lib/file-validation'

// ── Minimal valid file buffers ────────────────────────────────────────────────

function makePdf(): Buffer {
  // %PDF followed by padding to reach 8 bytes
  return Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
}

function makePng(): Buffer {
  // Full PNG magic: 89 50 4E 47 0D 0A 1A 0A + padding
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
}

function makeJpg(): Buffer {
  // FF D8 FF + SOF marker + padding
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
}

function makeExe(): Buffer {
  // MZ header (Windows PE executable)
  return Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])
}

function makeZip(): Buffer {
  // PK header (ZIP / DOCX / XLSX)
  return Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00])
}

// ── detectFileTypeByMagicBytes ────────────────────────────────────────────────

describe('detectFileTypeByMagicBytes', () => {
  it('detecta PDF por magic bytes %PDF', () => {
    const r = detectFileTypeByMagicBytes(makePdf())
    expect(r.valid).toBe(true)
    if (r.valid) {
      expect(r.detectedType).toBe('pdf')
      expect(r.mimeType).toBe('application/pdf')
      expect(r.extension).toBe('pdf')
    }
  })

  it('detecta PNG por magic bytes 89 50 4E 47...', () => {
    const r = detectFileTypeByMagicBytes(makePng())
    expect(r.valid).toBe(true)
    if (r.valid) {
      expect(r.detectedType).toBe('png')
      expect(r.mimeType).toBe('image/png')
      expect(r.extension).toBe('png')
    }
  })

  it('detecta JPG por magic bytes FF D8 FF', () => {
    const r = detectFileTypeByMagicBytes(makeJpg())
    expect(r.valid).toBe(true)
    if (r.valid) {
      expect(r.detectedType).toBe('jpg')
      expect(r.mimeType).toBe('image/jpeg')
      expect(r.extension).toBe('jpg')
    }
  })

  it('rechaza buffer vacío con reason empty_file', () => {
    const r = detectFileTypeByMagicBytes(Buffer.alloc(0))
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.reason).toBe('empty_file')
  })

  it('rechaza buffer demasiado pequeño con reason file_too_small', () => {
    const r = detectFileTypeByMagicBytes(Buffer.from([0x25, 0x50]))
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.reason).toBe('file_too_small')
  })

  it('rechaza EXE (MZ header) con reason unsupported_file_type', () => {
    const r = detectFileTypeByMagicBytes(makeExe())
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.reason).toBe('unsupported_file_type')
  })

  it('rechaza ZIP (PK header) con reason unsupported_file_type', () => {
    const r = detectFileTypeByMagicBytes(makeZip())
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.reason).toBe('unsupported_file_type')
  })

  it('rechaza bytes todos cero con reason unsupported_file_type', () => {
    const r = detectFileTypeByMagicBytes(Buffer.alloc(16, 0))
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.reason).toBe('unsupported_file_type')
  })
})

// ── validateAllowedUpload — sin MIME declarado ────────────────────────────────

describe('validateAllowedUpload — sin MIME declarado', () => {
  it('PDF válido pasa sin MIME', () => {
    expect(validateAllowedUpload(makePdf()).valid).toBe(true)
  })

  it('PNG válido pasa sin MIME', () => {
    expect(validateAllowedUpload(makePng()).valid).toBe(true)
  })

  it('JPG válido pasa sin MIME', () => {
    expect(validateAllowedUpload(makeJpg()).valid).toBe(true)
  })

  it('EXE falla sin MIME', () => {
    const r = validateAllowedUpload(makeExe())
    expect(r.valid).toBe(false)
  })
})

// ── validateAllowedUpload — con MIME declarado (cross-check) ──────────────────

describe('validateAllowedUpload — con MIME declarado', () => {
  it('PDF + MIME application/pdf → válido', () => {
    const r = validateAllowedUpload(makePdf(), 'application/pdf')
    expect(r.valid).toBe(true)
  })

  it('PNG + MIME image/png → válido', () => {
    const r = validateAllowedUpload(makePng(), 'image/png')
    expect(r.valid).toBe(true)
  })

  it('JPG + MIME image/jpeg → válido', () => {
    const r = validateAllowedUpload(makeJpg(), 'image/jpeg')
    expect(r.valid).toBe(true)
  })

  it('JPG + MIME image/jpg (variante browser) → válido', () => {
    const r = validateAllowedUpload(makeJpg(), 'image/jpg')
    expect(r.valid).toBe(true)
  })

  it('EXE con MIME application/pdf → rechazado (mime_mismatch o unsupported)', () => {
    const r = validateAllowedUpload(makeExe(), 'application/pdf')
    expect(r.valid).toBe(false)
  })

  it('PDF con MIME image/png → rechazado por mime_mismatch', () => {
    const r = validateAllowedUpload(makePdf(), 'image/png')
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.reason).toBe('mime_mismatch')
  })

  it('PNG con MIME application/pdf → rechazado por mime_mismatch', () => {
    const r = validateAllowedUpload(makePng(), 'application/pdf')
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.reason).toBe('mime_mismatch')
  })

  it('PDF válido + MIME image/tiff → rechazado (TIFF no en MVP)', () => {
    const r = validateAllowedUpload(makePdf(), 'image/tiff')
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.reason).toBe('unsupported_file_type')
  })

  it('PDF válido + MIME image/webp → rechazado', () => {
    const r = validateAllowedUpload(makePdf(), 'image/webp')
    expect(r.valid).toBe(false)
  })
})

// ── assertAllowedUpload ───────────────────────────────────────────────────────

describe('assertAllowedUpload', () => {
  it('retorna FileTypeResult para PDF válido', () => {
    const r = assertAllowedUpload(makePdf(), 'application/pdf')
    expect(r.valid).toBe(true)
    expect(r.detectedType).toBe('pdf')
  })

  it('lanza FileValidationError para EXE', () => {
    expect(() => assertAllowedUpload(makeExe(), 'application/pdf')).toThrow(FileValidationError)
  })

  it('FileValidationError tiene reason accesible', () => {
    try {
      assertAllowedUpload(makeExe(), 'application/pdf')
    } catch (err) {
      expect(err).toBeInstanceOf(FileValidationError)
      if (err instanceof FileValidationError) {
        expect(err.reason).toBeTruthy()
        expect(typeof err.reason).toBe('string')
      }
    }
  })

  it('mensaje de error no expone bytes ni detalles técnicos del archivo', () => {
    try {
      assertAllowedUpload(makeExe(), 'application/pdf')
    } catch (err) {
      if (err instanceof Error) {
        expect(err.message).not.toContain('0x4d')
        expect(err.message).not.toContain('0x5a')
        expect(err.message).not.toContain('MZ')
        expect(err.message).not.toContain('EXE')
        expect(err.message.length).toBeLessThan(200)
      }
    }
  })

  it('lanza FileValidationError para buffer vacío', () => {
    expect(() => assertAllowedUpload(Buffer.alloc(0))).toThrow(FileValidationError)
  })
})

// ── getAllowedFileTypes ────────────────────────────────────────────────────────

describe('getAllowedFileTypes', () => {
  it('retorna exactamente pdf, png, jpg', () => {
    const types = getAllowedFileTypes()
    expect(types).toEqual(expect.arrayContaining(['pdf', 'png', 'jpg']))
    expect(types).toHaveLength(3)
  })

  it('no incluye tipos peligrosos', () => {
    const types = getAllowedFileTypes()
    expect(types).not.toContain('exe')
    expect(types).not.toContain('zip')
    expect(types).not.toContain('tiff')
    expect(types).not.toContain('webp')
    expect(types).not.toContain('heic')
    expect(types).not.toContain('svg')
  })
})
