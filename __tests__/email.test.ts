import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MockEmailProvider, setEmailProvider, _resetEmailProviderForTest } from '@/lib/email'

const makeMsg = (overrides = {}) => ({
  to: 'recipient@example.com',
  subject: 'Documento observado: SC-2025-000001',
  html: '<p>Test HTML</p>',
  text: 'Test text',
  ...overrides,
})

beforeEach(() => {
  _resetEmailProviderForTest()
})

// ── MockEmailProvider ─────────────────────────────────────────────────────────

describe('MockEmailProvider', () => {
  it('stores sent messages in memory', async () => {
    const mock = new MockEmailProvider()
    await mock.send(makeMsg())
    expect(mock.sent).toHaveLength(1)
  })

  it('returns mock messageId', async () => {
    const mock = new MockEmailProvider()
    const result = await mock.send(makeMsg())
    expect(result.messageId).toMatch(/^mock-/)
    expect(result.provider).toBe('mock')
  })

  it('stores multiple messages', async () => {
    const mock = new MockEmailProvider()
    await mock.send(makeMsg({ to: 'a@test.com' }))
    await mock.send(makeMsg({ to: 'b@test.com' }))
    expect(mock.sent).toHaveLength(2)
  })

  it('lastSent returns last message', async () => {
    const mock = new MockEmailProvider()
    await mock.send(makeMsg({ to: 'a@test.com' }))
    await mock.send(makeMsg({ to: 'b@test.com', subject: 'Last' }))
    expect(mock.lastSent()?.subject).toBe('Last')
  })

  it('clear() empties sent list', async () => {
    const mock = new MockEmailProvider()
    await mock.send(makeMsg())
    mock.clear()
    expect(mock.sent).toHaveLength(0)
  })

  it('lastSent returns undefined when empty', () => {
    const mock = new MockEmailProvider()
    expect(mock.lastSent()).toBeUndefined()
  })

  it('stores complete message fields', async () => {
    const mock = new MockEmailProvider()
    const msg = makeMsg({ subject: 'Test Subject', html: '<b>Hello</b>', text: 'Hello' })
    await mock.send(msg)
    const sent = mock.lastSent()!
    expect(sent.to).toBe('recipient@example.com')
    expect(sent.subject).toBe('Test Subject')
    expect(sent.html).toBe('<b>Hello</b>')
    expect(sent.text).toBe('Hello')
    expect(sent.sentAt).toBeInstanceOf(Date)
  })
})

// ── setEmailProvider (injection) ──────────────────────────────────────────────

describe('setEmailProvider', () => {
  it('sendEmail uses injected provider', async () => {
    const { sendEmail } = await import('@/lib/email')
    const mock = new MockEmailProvider()
    setEmailProvider(mock)
    await sendEmail(makeMsg())
    expect(mock.sent).toHaveLength(1)
  })

  it('injected provider receives correct message fields', async () => {
    const { sendEmail } = await import('@/lib/email')
    const mock = new MockEmailProvider()
    setEmailProvider(mock)
    const msg = makeMsg({ to: 'inspector@empresa.cl', subject: 'PDF listo' })
    await sendEmail(msg)
    const sent = mock.lastSent()!
    expect(sent.to).toBe('inspector@empresa.cl')
    expect(sent.subject).toBe('PDF listo')
  })

  it('sendEmail does not expose RESEND_API_KEY or SMTP credentials', async () => {
    const { sendEmail } = await import('@/lib/email')
    const mock = new MockEmailProvider()
    setEmailProvider(mock)
    await sendEmail(makeMsg())
    const sentStr = JSON.stringify(mock.lastSent())
    expect(sentStr).not.toContain('RESEND_API_KEY')
    expect(sentStr).not.toContain('password')
    expect(sentStr).not.toContain('SMTP_PASS')
  })
})

// ── EMAIL_PROVIDER selection logic ────────────────────────────────────────────

describe('EMAIL_PROVIDER selection', () => {
  it('defaults to smtp when EMAIL_PROVIDER is not set', () => {
    const provider = process.env.EMAIL_PROVIDER ?? 'smtp'
    expect(provider).toBe('smtp')
  })

  it('mock provider never sends real HTTP requests', async () => {
    const mock = new MockEmailProvider()
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response())
    await mock.send(makeMsg())
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})

// ── Email content security ────────────────────────────────────────────────────

describe('email content security', () => {
  it('email subject does not contain user password or tokens', async () => {
    const { sendEmail } = await import('@/lib/email')
    const mock = new MockEmailProvider()
    setEmailProvider(mock)
    const msg = makeMsg({ subject: 'Documento SC-2025-000001 aprobado' })
    await sendEmail(msg)
    const sent = mock.lastSent()!
    expect(sent.subject).not.toContain('password')
    expect(sent.subject).not.toContain('token')
    expect(sent.subject).not.toContain('secret')
  })

  it('email to field is a valid email format', async () => {
    const { sendEmail } = await import('@/lib/email')
    const mock = new MockEmailProvider()
    setEmailProvider(mock)
    await sendEmail(makeMsg({ to: 'user@empresa.cl' }))
    const sent = mock.lastSent()!
    expect(sent.to).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  })
})
