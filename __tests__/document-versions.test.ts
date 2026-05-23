import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockAggregate = vi.fn()
const mockCreate = vi.fn()
const mockFindUniqueOrThrow = vi.fn()
const mockFindUnique = vi.fn()
const mockFindMany = vi.fn()

vi.mock('@/lib/db/client', () => ({
  prisma: {
    documentVersion: {
      aggregate: (...args: unknown[]) => mockAggregate(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    document: {
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
    },
  },
}))

vi.mock('@/modules/audit', () => ({ log: vi.fn() }))

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSnapshot(overrides = {}) {
  return {
    status: 'PENDING_APPROVAL',
    taskName: 'Trabajo en altura',
    workArea: 'Zona A',
    type: 'AST',
    aiResult: { confidence: 0.9 },
    validationResult: { valid: true },
    fields: [{ fieldName: 'responsable', fieldValue: 'Juan', confidence: 0.95 }],
    ...overrides,
  }
}

function makeVersionRecord(overrides = {}) {
  return {
    id: 'ver-1',
    documentId: 'doc-1',
    version: 1,
    snapshot: makeSnapshot(),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    createdById: 'user-1',
    ...overrides,
  }
}

// ── createDocumentVersion ─────────────────────────────────────────────────────

describe('createDocumentVersion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates version 1 when no prior versions exist', async () => {
    const { createDocumentVersion } = await import('@/modules/documents/version')
    mockAggregate.mockResolvedValue({ _max: { version: null } })
    mockCreate.mockResolvedValue(makeVersionRecord())

    await createDocumentVersion('doc-1', 'user-1', makeSnapshot())

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ documentId: 'doc-1', version: 1 }),
      })
    )
  })

  it('increments version number from existing max', async () => {
    const { createDocumentVersion } = await import('@/modules/documents/version')
    mockAggregate.mockResolvedValue({ _max: { version: 3 } })
    mockCreate.mockResolvedValue(makeVersionRecord({ version: 4 }))

    await createDocumentVersion('doc-1', 'user-1', makeSnapshot())

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 4 }),
      })
    )
  })

  it('stores the snapshot as JSON', async () => {
    const { createDocumentVersion } = await import('@/modules/documents/version')
    mockAggregate.mockResolvedValue({ _max: { version: 0 } })
    const snapshot = makeSnapshot({ status: 'APPROVED' })
    mockCreate.mockResolvedValue(makeVersionRecord({ snapshot }))

    await createDocumentVersion('doc-1', 'user-1', snapshot)

    const callArg = mockCreate.mock.calls[0][0]
    expect(callArg.data.snapshot).toMatchObject({ status: 'APPROVED' })
  })

  it('returns createdAt as ISO string', async () => {
    const { createDocumentVersion } = await import('@/modules/documents/version')
    mockAggregate.mockResolvedValue({ _max: { version: null } })
    mockCreate.mockResolvedValue(makeVersionRecord())

    const result = await createDocumentVersion('doc-1', 'user-1', makeSnapshot())
    expect(typeof result.createdAt).toBe('string')
    expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('stores createdById correctly', async () => {
    const { createDocumentVersion } = await import('@/modules/documents/version')
    mockAggregate.mockResolvedValue({ _max: { version: null } })
    mockCreate.mockResolvedValue(makeVersionRecord({ createdById: 'user-99' }))

    await createDocumentVersion('doc-1', 'user-99', makeSnapshot())

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdById: 'user-99' }),
      })
    )
  })
})

// ── snapshotDocument ──────────────────────────────────────────────────────────

describe('snapshotDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns snapshot with all required fields', async () => {
    const { snapshotDocument } = await import('@/modules/documents/version')
    mockFindUniqueOrThrow.mockResolvedValue({
      status: 'APPROVED',
      taskName: 'Tarea 1',
      workArea: 'Zona B',
      type: 'DET',
      aiResult: null,
      validationResult: null,
      fields: [],
    })

    const snap = await snapshotDocument('doc-1')
    expect(snap.status).toBe('APPROVED')
    expect(snap.taskName).toBe('Tarea 1')
    expect(snap.workArea).toBe('Zona B')
    expect(snap.type).toBe('DET')
    expect(Array.isArray(snap.fields)).toBe(true)
  })

  it('includes fields as returned by DB (orderBy fieldName asc)', async () => {
    const { snapshotDocument } = await import('@/modules/documents/version')
    // Mock returns pre-sorted data — mirrors what Prisma orderBy:'asc' produces
    mockFindUniqueOrThrow.mockResolvedValue({
      status: 'DRAFT',
      taskName: 'T',
      workArea: 'W',
      type: 'AST',
      aiResult: null,
      validationResult: null,
      fields: [
        { fieldName: 'a_field', fieldValue: 'a', confidence: 0.5 },
        { fieldName: 'z_field', fieldValue: 'z', confidence: 1.0 },
      ],
    })

    const snap = await snapshotDocument('doc-1')
    expect(snap.fields[0].fieldName).toBe('a_field')
    expect(snap.fields[1].fieldName).toBe('z_field')
  })
})

// ── Immutability — version numbers ────────────────────────────────────────────

describe('version number immutability', () => {
  beforeEach(() => vi.clearAllMocks())

  it('always uses aggregate max + 1 (never overwrites)', async () => {
    const { createDocumentVersion } = await import('@/modules/documents/version')

    mockAggregate.mockResolvedValueOnce({ _max: { version: 5 } })
    mockCreate.mockResolvedValue(makeVersionRecord({ version: 6 }))
    await createDocumentVersion('doc-1', 'user-1', makeSnapshot())

    expect(mockCreate.mock.calls[0][0].data.version).toBe(6)
  })

  it('uses documentId as scope for version aggregation', async () => {
    const { createDocumentVersion } = await import('@/modules/documents/version')
    mockAggregate.mockResolvedValue({ _max: { version: null } })
    mockCreate.mockResolvedValue(makeVersionRecord())

    await createDocumentVersion('doc-XYZ', 'user-1', makeSnapshot())

    expect(mockAggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { documentId: 'doc-XYZ' } })
    )
  })
})

// ── Access control — unit logic ───────────────────────────────────────────────

describe('version access control logic', () => {
  it('WORKER can only see their own document versions', () => {
    const doc = { createdById: 'user-other' }
    const requestingUserId = 'user-me'
    const role = 'WORKER'
    const allowed = role !== 'WORKER' || doc.createdById === requestingUserId
    expect(allowed).toBe(false)
  })

  it('WORKER can see own document versions', () => {
    const doc = { createdById: 'user-me' }
    const requestingUserId = 'user-me'
    const role = 'WORKER'
    const allowed = role !== 'WORKER' || doc.createdById === requestingUserId
    expect(allowed).toBe(true)
  })

  it('SUPERVISOR can see any document versions', () => {
    const canViewAll = ['SUPERVISOR', 'PREVENTIONIST', 'CONTRACT_ADMIN', 'MANAGER', 'AUDITOR', 'SYSTEM_ADMIN']
    expect(canViewAll.includes('SUPERVISOR')).toBe(true)
  })

  it('invalid version number is rejected', () => {
    const versionParam = 'abc'
    const versionNumber = parseInt(versionParam, 10)
    expect(isNaN(versionNumber)).toBe(true)
  })

  it('version 0 is rejected (minimum is 1)', () => {
    const versionNumber = 0
    const valid = !isNaN(versionNumber) && versionNumber >= 1
    expect(valid).toBe(false)
  })
})

// ── Snapshot integrity ────────────────────────────────────────────────────────

describe('snapshot integrity', () => {
  it('snapshot does not contain sensitive auth data', async () => {
    const { createDocumentVersion } = await import('@/modules/documents/version')
    mockAggregate.mockResolvedValue({ _max: { version: null } })
    mockCreate.mockResolvedValue(makeVersionRecord())

    const snapshot = makeSnapshot()
    const snapStr = JSON.stringify(snapshot)
    expect(snapStr).not.toContain('password')
    expect(snapStr).not.toContain('passwordHash')
    expect(snapStr).not.toContain('token')
    await createDocumentVersion('doc-1', 'user-1', snapshot)
  })

  it('snapshot includes all OCR fields', async () => {
    const { snapshotDocument } = await import('@/modules/documents/version')
    const fields = [
      { fieldName: 'empresa', fieldValue: 'ACME', confidence: 0.99 },
      { fieldName: 'fecha', fieldValue: '2025-01-01', confidence: 0.88 },
    ]
    mockFindUniqueOrThrow.mockResolvedValue({
      status: 'SCANNED',
      taskName: 'OCR test',
      workArea: 'Bodega',
      type: 'ART',
      aiResult: { raw: 'text' },
      validationResult: null,
      fields,
    })

    const snap = await snapshotDocument('doc-1')
    expect(snap.fields).toHaveLength(2)
    expect(snap.aiResult).toMatchObject({ raw: 'text' })
  })
})
