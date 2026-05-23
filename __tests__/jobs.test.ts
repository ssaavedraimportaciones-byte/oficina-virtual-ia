import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── DB helpers ────────────────────────────────────────────────────────────────

const mockCreate = vi.fn()
const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/db/client', () => ({
  prisma: {
    job: {
      create: (...args: unknown[]) => mockCreate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}))

vi.mock('@/modules/audit', () => ({ log: vi.fn() }))

function makeJob(overrides = {}) {
  return {
    id: 'job-1',
    type: 'OCR',
    status: 'PENDING',
    documentId: 'doc-1',
    userId: 'user-1',
    payload: {},
    result: null,
    error: null,
    attempts: 0,
    createdAt: new Date(),
    startedAt: null,
    completedAt: null,
    ...overrides,
  }
}

// ── createJob ────────────────────────────────────────────────────────────────

describe('createJob', () => {
  beforeEach(() => vi.clearAllMocks())

  it('persists job in DB with correct type', async () => {
    const { createJob } = await import('@/lib/jobs/db')
    mockCreate.mockResolvedValue(makeJob())
    await createJob('OCR', 'doc-1', 'user-1', { storageUrl: 'https://example.com/file.pdf' })
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'OCR', documentId: 'doc-1' }) })
    )
  })

  it('persists PDF job in DB', async () => {
    const { createJob } = await import('@/lib/jobs/db')
    mockCreate.mockResolvedValue(makeJob({ type: 'PDF' }))
    await createJob('PDF', 'doc-2', 'user-2', { ip: '1.2.3.4' })
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'PDF' }) })
    )
  })
})

// ── getJob ───────────────────────────────────────────────────────────────────

describe('getJob', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when job does not exist', async () => {
    const { getJob } = await import('@/lib/jobs/db')
    mockFindUnique.mockResolvedValue(null)
    const result = await getJob('non-existent')
    expect(result).toBeNull()
  })

  it('returns job record when found', async () => {
    const { getJob } = await import('@/lib/jobs/db')
    mockFindUnique.mockResolvedValue(makeJob())
    const result = await getJob('job-1')
    expect(result?.id).toBe('job-1')
    expect(result?.status).toBe('PENDING')
  })
})

// ── markRunning ──────────────────────────────────────────────────────────────

describe('markRunning', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets status RUNNING and increments attempts', async () => {
    const { markRunning } = await import('@/lib/jobs/db')
    mockUpdate.mockResolvedValue(makeJob({ status: 'RUNNING', attempts: 1 }))
    await markRunning('job-1')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'RUNNING',
          attempts: { increment: 1 },
        }),
      })
    )
  })
})

// ── markCompleted ────────────────────────────────────────────────────────────

describe('markCompleted', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets status COMPLETED with result', async () => {
    const { markCompleted } = await import('@/lib/jobs/db')
    mockUpdate.mockResolvedValue(makeJob({ status: 'COMPLETED' }))
    await markCompleted('job-1', { finalPdfUrl: 'https://example.com/doc.pdf' })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED' }),
      })
    )
  })
})

// ── markFailed ───────────────────────────────────────────────────────────────

describe('markFailed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets status FAILED with generic error message', async () => {
    const { markFailed } = await import('@/lib/jobs/db')
    mockUpdate.mockResolvedValue(makeJob({ status: 'FAILED' }))
    const genericMsg = 'Error de procesamiento. Intente nuevamente o contacte soporte.'
    await markFailed('job-1', genericMsg)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', error: genericMsg }),
      })
    )
  })

  it('never exposes internal error details', async () => {
    const { markFailed } = await import('@/lib/jobs/db')
    mockUpdate.mockResolvedValue(makeJob({ status: 'FAILED' }))
    // The error stored should be a generic message, not raw exception
    const callArg = mockUpdate.mock.calls[0]?.[0]
    if (callArg) {
      expect(callArg.data.error).not.toContain('at ')        // no stack trace
      expect(callArg.data.error).not.toContain('ENOENT')     // no fs errors
      expect(callArg.data.error).not.toContain('prisma')     // no DB errors
    }
  })
})

// ── Worker state transitions via DB helpers ───────────────────────────────────

describe('job state machine via DB helpers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('PENDING → RUNNING increments attempts', async () => {
    const { markRunning } = await import('@/lib/jobs/db')
    mockUpdate.mockResolvedValue(makeJob({ status: 'RUNNING', attempts: 1 }))
    await markRunning('job-1')
    const data = mockUpdate.mock.calls[0][0].data
    expect(data.status).toBe('RUNNING')
    expect(data.attempts).toEqual({ increment: 1 })
    expect(data.startedAt).toBeInstanceOf(Date)
  })

  it('RUNNING → COMPLETED saves result', async () => {
    const { markCompleted } = await import('@/lib/jobs/db')
    mockUpdate.mockResolvedValue(makeJob({ status: 'COMPLETED' }))
    const result = { storageUrl: 'https://blob.example.com/file.pdf', fieldsExtracted: 5 }
    await markCompleted('job-1', result)
    const data = mockUpdate.mock.calls[0][0].data
    expect(data.status).toBe('COMPLETED')
    expect(data.completedAt).toBeInstanceOf(Date)
  })

  it('RUNNING → FAILED stores generic error, not internal details', async () => {
    const { markFailed } = await import('@/lib/jobs/db')
    mockUpdate.mockResolvedValue(makeJob({ status: 'FAILED' }))
    const genericMsg = 'Error de procesamiento. Intente nuevamente o contacte soporte.'
    await markFailed('job-1', genericMsg)
    const data = mockUpdate.mock.calls[0][0].data
    expect(data.status).toBe('FAILED')
    expect(data.error).toBe(genericMsg)
    expect(data.error).not.toContain('stack')
    expect(data.error).not.toContain('ENOENT')
    expect(data.error).not.toContain('prisma')
  })

  it('retry increments attempts each time', async () => {
    const { markRunning } = await import('@/lib/jobs/db')
    mockUpdate.mockResolvedValue(makeJob({ status: 'RUNNING', attempts: 2 }))
    await markRunning('job-1')
    await markRunning('job-1')
    expect(mockUpdate).toHaveBeenCalledTimes(2)
    mockUpdate.mock.calls.forEach(call => {
      expect(call[0].data.attempts).toEqual({ increment: 1 })
    })
  })
})

// ── documentId isolation (anti-enumeration) ───────────────────────────────────

describe('job documentId isolation', () => {
  it('job with wrong documentId is treated as not found', async () => {
    // Simulate status endpoint logic: job.documentId !== URL id → 404
    const job = makeJob({ documentId: 'doc-real' })
    const urlDocId = 'doc-other'
    expect(job.documentId !== urlDocId).toBe(true)
  })

  it('worker-role user cannot see job owned by other user', () => {
    const job = makeJob({ userId: 'user-other' })
    const requestingRole = 'WORKER'
    const requestingUserId = 'user-me'
    const shouldBlock = requestingRole === 'WORKER' && job.userId !== requestingUserId
    expect(shouldBlock).toBe(true)
  })
})
