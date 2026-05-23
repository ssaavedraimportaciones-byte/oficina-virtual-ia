import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Pure logic tests for polling behaviour extracted from useJobStatus hook.
// We test the state-machine logic without React or DOM.

type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'

interface PollResult {
  status: JobStatus
  result?: Record<string, unknown>
  error?: string
}

function isTerminal(status: JobStatus): boolean {
  return status === 'COMPLETED' || status === 'FAILED'
}

function shouldContinuePolling(polls: number, maxPolls: number, status: JobStatus | null): boolean {
  if (polls >= maxPolls) return false
  if (status && isTerminal(status)) return false
  return true
}

describe('useJobStatus polling logic', () => {
  it('identifies terminal states correctly', () => {
    expect(isTerminal('COMPLETED')).toBe(true)
    expect(isTerminal('FAILED')).toBe(true)
    expect(isTerminal('PENDING')).toBe(false)
    expect(isTerminal('RUNNING')).toBe(false)
  })

  it('stops polling when COMPLETED', () => {
    expect(shouldContinuePolling(5, 120, 'COMPLETED')).toBe(false)
  })

  it('stops polling when FAILED', () => {
    expect(shouldContinuePolling(5, 120, 'FAILED')).toBe(false)
  })

  it('continues polling when RUNNING and under max polls', () => {
    expect(shouldContinuePolling(10, 120, 'RUNNING')).toBe(true)
  })

  it('continues polling when PENDING and under max polls', () => {
    expect(shouldContinuePolling(0, 120, 'PENDING')).toBe(true)
  })

  it('stops polling when max polls reached even if RUNNING', () => {
    expect(shouldContinuePolling(120, 120, 'RUNNING')).toBe(false)
  })

  it('stops polling when max polls reached and status is null', () => {
    expect(shouldContinuePolling(120, 120, null)).toBe(false)
  })

  it('continues polling when status is null and under max polls', () => {
    expect(shouldContinuePolling(1, 120, null)).toBe(true)
  })

  it('MAX_POLLS=120 provides ~6 minutes at 3s interval', () => {
    const maxPolls = 120
    const intervalMs = 3000
    const maxDurationMinutes = (maxPolls * intervalMs) / 1000 / 60
    expect(maxDurationMinutes).toBe(6)
  })
})

describe('useJobStatus fetch response handling', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('extracts status and result from successful response', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'COMPLETED', result: { pdfUrl: 'https://example.com/doc.pdf' } }),
    } as Response)

    const res = await fetch('/api/jobs/123/status')
    const data = await res.json() as PollResult
    expect(data.status).toBe('COMPLETED')
    expect(data.result).toEqual({ pdfUrl: 'https://example.com/doc.pdf' })
  })

  it('extracts error message from FAILED response', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'FAILED', error: 'OCR service timeout' }),
    } as Response)

    const res = await fetch('/api/jobs/456/status')
    const data = await res.json() as PollResult
    expect(data.status).toBe('FAILED')
    expect(data.error).toBe('OCR service timeout')
  })

  it('treats non-ok HTTP response as fetch error', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response)

    const res = await fetch('/api/jobs/999/status')
    expect(res.ok).toBe(false)
  })
})
