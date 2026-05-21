import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import {
  validateSignatureImage,
  hashSignatureImage,
  buildDocumentSnapshot,
  hashDocumentSnapshot,
  createSignatureHash,
} from '@/modules/signatures/hash'

// Minimal valid 1×1 PNG (binary, base64-encoded)
const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const VALID_PNG_DATA_URL = `data:image/png;base64,${VALID_PNG_BASE64}`

// PNG magic bytes as Buffer
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

describe('validateSignatureImage', () => {
  it('acepta PNG válido y retorna Buffer con magic bytes correctos', () => {
    const buf = validateSignatureImage(VALID_PNG_DATA_URL)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.subarray(0, 8)).toEqual(PNG_MAGIC)
  })

  it('rechaza si no empieza con data:image/png;base64,', () => {
    expect(() => validateSignatureImage('data:image/svg+xml;base64,abc')).toThrow('PNG')
    expect(() => validateSignatureImage('data:image/jpeg;base64,abc')).toThrow('PNG')
    expect(() => validateSignatureImage('')).toThrow()
  })

  it('rechaza imagen vacía (base64 vacío)', () => {
    expect(() => validateSignatureImage('data:image/png;base64,')).toThrow('vacía')
  })

  it('rechaza base64 con magic bytes incorrectos (no es PNG real)', () => {
    // JPG magic bytes: FF D8 FF E0
    const jpgFakeAsPng = 'data:image/png;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(200).fill(0)]).toString('base64')
    expect(() => validateSignatureImage(jpgFakeAsPng)).toThrow('magic bytes')
  })

  it('rechaza si supera tamaño máximo', () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(600_000)
    expect(() => validateSignatureImage(big)).toThrow('tamaño máximo')
  })
})

describe('hashSignatureImage', () => {
  it('retorna hex de 64 caracteres (SHA-256)', () => {
    const buf = validateSignatureImage(VALID_PNG_DATA_URL)
    const hash = hashSignatureImage(buf)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('es determinístico — mismo input produce mismo hash', () => {
    const buf = validateSignatureImage(VALID_PNG_DATA_URL)
    expect(hashSignatureImage(buf)).toBe(hashSignatureImage(buf))
  })

  it('cambia si el buffer cambia', () => {
    const buf1 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00])
    const buf2 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x01])
    expect(hashSignatureImage(buf1)).not.toBe(hashSignatureImage(buf2))
  })
})

const docBase = {
  id: 'doc-1',
  folio: 'CHG-2024-001',
  type: 'CHARLA_SEGURIDAD',
  status: 'PENDING_SIGNATURE',
  taskName: 'Excavación nivel 3',
  workArea: 'Galería Norte',
  companyId: 'company-1',
  createdById: 'user-1',
  fields: [
    { fieldName: 'fecha', fieldValue: '2024-01-15' },
    { fieldName: 'tema', fieldValue: 'Uso de EPP' },
  ],
}

describe('buildDocumentSnapshot', () => {
  it('retorna JSON string determinístico', () => {
    const s1 = buildDocumentSnapshot(docBase)
    const s2 = buildDocumentSnapshot(docBase)
    expect(s1).toBe(s2)
  })

  it('ordena campos por fieldName alfabéticamente', () => {
    const shuffled = { ...docBase, fields: [{ fieldName: 'zzz', fieldValue: 'z' }, { fieldName: 'aaa', fieldValue: 'a' }] }
    const snap = JSON.parse(buildDocumentSnapshot(shuffled))
    expect(snap.fields[0].name).toBe('aaa')
    expect(snap.fields[1].name).toBe('zzz')
  })

  it('snapshot cambia si taskName cambia', () => {
    const snap1 = buildDocumentSnapshot(docBase)
    const snap2 = buildDocumentSnapshot({ ...docBase, taskName: 'Otra tarea' })
    expect(snap1).not.toBe(snap2)
  })

  it('snapshot cambia si un campo OCR cambia', () => {
    const snap1 = buildDocumentSnapshot(docBase)
    const modified = {
      ...docBase,
      fields: [
        { fieldName: 'fecha', fieldValue: '2024-01-15' },
        { fieldName: 'tema', fieldValue: 'DIFERENTE' },
      ],
    }
    expect(buildDocumentSnapshot(modified)).not.toBe(snap1)
  })
})

describe('hashDocumentSnapshot', () => {
  it('retorna hex de 64 caracteres', () => {
    const snap = buildDocumentSnapshot(docBase)
    const hash = hashDocumentSnapshot(snap)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('es igual al SHA-256 manual del snapshot', () => {
    const snap = buildDocumentSnapshot(docBase)
    const expected = createHash('sha256').update(snap).digest('hex')
    expect(hashDocumentSnapshot(snap)).toBe(expected)
  })
})

describe('createSignatureHash', () => {
  const params = {
    documentId: 'doc-1',
    userId: 'user-1',
    taskName: 'Excavación nivel 3',
    workArea: 'Galería Norte',
    documentType: 'CHARLA_SEGURIDAD',
    signedAt: new Date('2024-01-15T10:00:00.000Z'),
    imageData: VALID_PNG_DATA_URL,
  }

  it('retorna hex de 64 caracteres', () => {
    expect(createSignatureHash(params)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('es determinístico', () => {
    expect(createSignatureHash(params)).toBe(createSignatureHash(params))
  })

  it('cambia si imageData cambia', () => {
    const alt = { ...params, imageData: 'data:image/png;base64,ZZZ' }
    expect(createSignatureHash(params)).not.toBe(createSignatureHash(alt))
  })

  it('cambia si userId cambia', () => {
    const alt = { ...params, userId: 'otro-usuario' }
    expect(createSignatureHash(params)).not.toBe(createSignatureHash(alt))
  })

  it('cambia si documentId cambia', () => {
    const alt = { ...params, documentId: 'otro-doc' }
    expect(createSignatureHash(params)).not.toBe(createSignatureHash(alt))
  })

  it('cambia si taskName cambia', () => {
    const alt = { ...params, taskName: 'Otra tarea' }
    expect(createSignatureHash(params)).not.toBe(createSignatureHash(alt))
  })
})
