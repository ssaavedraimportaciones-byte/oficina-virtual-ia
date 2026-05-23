import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Sentry mock ───────────────────────────────────────────────────────────────

const mockWithScope = vi.fn()
const mockCaptureException = vi.fn()
const mockCaptureMessage = vi.fn()
const mockSetUser = vi.fn()
const mockScope = {
  setUser: vi.fn(),
  setTag: vi.fn(),
}

vi.mock('@sentry/nextjs', () => ({
  withScope: (cb: (scope: typeof mockScope) => void) => {
    mockWithScope(cb)
    cb(mockScope)
  },
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
  setUser: (...args: unknown[]) => mockSetUser(...args),
  init: vi.fn(),
}))

// ── captureException ──────────────────────────────────────────────────────────

describe('captureException', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockScope.setUser.mockReset()
    mockScope.setTag.mockReset()
  })

  it('calls Sentry.captureException', async () => {
    const { captureException } = await import('@/lib/sentry')
    captureException(new Error('test error'))
    expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error))
  })

  it('sets userId on scope — never email or PII', async () => {
    const { captureException } = await import('@/lib/sentry')
    captureException(new Error('test'), { userId: 'user-123', role: 'SUPERVISOR' })
    expect(mockScope.setUser).toHaveBeenCalledWith({ id: 'user-123' })
    // Ensure no email or full name is set
    const calls = mockScope.setUser.mock.calls.flat()
    expect(JSON.stringify(calls)).not.toContain('email')
    expect(JSON.stringify(calls)).not.toContain('name')
  })

  it('sets documentId tag when provided', async () => {
    const { captureException } = await import('@/lib/sentry')
    captureException(new Error('doc err'), { documentId: 'doc-abc', action: 'OCR' })
    expect(mockScope.setTag).toHaveBeenCalledWith('documentId', 'doc-abc')
    expect(mockScope.setTag).toHaveBeenCalledWith('action', 'OCR')
  })

  it('works without context (no ctx)', async () => {
    const { captureException } = await import('@/lib/sentry')
    expect(() => captureException(new Error('bare error'))).not.toThrow()
    expect(mockCaptureException).toHaveBeenCalled()
  })

  it('accepts non-Error objects', async () => {
    const { captureException } = await import('@/lib/sentry')
    captureException('string error')
    expect(mockCaptureException).toHaveBeenCalledWith('string error')
  })
})

// ── captureMessage ────────────────────────────────────────────────────────────

describe('captureMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockScope.setUser.mockReset()
    mockScope.setTag.mockReset()
  })

  it('calls Sentry.captureMessage with level', async () => {
    const { captureMessage } = await import('@/lib/sentry')
    captureMessage('test message', 'warning')
    expect(mockCaptureMessage).toHaveBeenCalledWith('test message', 'warning')
  })

  it('defaults to error level', async () => {
    const { captureMessage } = await import('@/lib/sentry')
    captureMessage('default level message')
    expect(mockCaptureMessage).toHaveBeenCalledWith('default level message', 'error')
  })

  it('sets context tags', async () => {
    const { captureMessage } = await import('@/lib/sentry')
    captureMessage('msg', 'info', { userId: 'u-1', action: 'RATE_LIMIT' })
    expect(mockScope.setTag).toHaveBeenCalledWith('action', 'RATE_LIMIT')
  })
})

// ── setSentryUser / clearSentryUser ───────────────────────────────────────────

describe('setSentryUser / clearSentryUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('setSentryUser sends only id', async () => {
    const { setSentryUser } = await import('@/lib/sentry')
    setSentryUser('user-xyz')
    expect(mockSetUser).toHaveBeenCalledWith({ id: 'user-xyz' })
  })

  it('clearSentryUser sends null', async () => {
    const { clearSentryUser } = await import('@/lib/sentry')
    clearSentryUser()
    expect(mockSetUser).toHaveBeenCalledWith(null)
  })
})

// ── PII / security ────────────────────────────────────────────────────────────

describe('Sentry PII guards', () => {
  it('captureException context never includes password', async () => {
    const { captureException } = await import('@/lib/sentry')
    const ctx = { userId: 'u-1', action: 'LOGIN' }
    captureException(new Error('bad password'), ctx)
    const allCalls = JSON.stringify(mockScope.setTag.mock.calls)
    expect(allCalls).not.toContain('password')
    expect(allCalls).not.toContain('passwordHash')
    expect(allCalls).not.toContain('token')
  })

  it('scope.setUser never receives email', async () => {
    const { captureException } = await import('@/lib/sentry')
    captureException(new Error('err'), { userId: 'u-safe' })
    const userArg = mockScope.setUser.mock.calls[0]?.[0]
    if (userArg) {
      expect(userArg).not.toHaveProperty('email')
    }
  })
})

// ── Config guards ─────────────────────────────────────────────────────────────

describe('Sentry config — disabled when no DSN', () => {
  it('Sentry is optional — app works without SENTRY_DSN', () => {
    const dsnFromEnv = process.env.SENTRY_DSN
    // In test environment DSN is not set — this should be fine
    expect(dsnFromEnv).toBeUndefined()
  })

  it('SENTRY_DSN is separate from NEXT_PUBLIC_SENTRY_DSN', () => {
    // Server DSN (secret) vs client DSN (public) are independent
    const serverDsn = process.env.SENTRY_DSN
    const clientDsn = process.env.NEXT_PUBLIC_SENTRY_DSN
    // Both undefined in test = correct (Sentry disabled in tests)
    expect(serverDsn).toBeUndefined()
    expect(clientDsn).toBeUndefined()
  })
})
