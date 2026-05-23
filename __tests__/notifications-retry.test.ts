import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  notification: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/db/client', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }))

import { scheduleRetry, processRetries, getDeadLetters } from '@/modules/notifications/retry'
import { sendEmail } from '@/lib/email'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('scheduleRetry', () => {
  it('schedules next retry with backoff on first failure', async () => {
    mockPrisma.notification.findUnique.mockResolvedValue({ retryCount: 0 })
    mockPrisma.notification.update.mockResolvedValue({})

    await scheduleRetry('notif-1', 'SMTP connection refused')

    expect(mockPrisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notif-1' },
        data: expect.objectContaining({
          retryCount: 1,
          status: 'FAILED',
          lastError: 'SMTP connection refused',
          nextRetryAt: expect.any(Date),
        }),
      })
    )
  })

  it('marks as dead letter after MAX_RETRIES exceeded', async () => {
    mockPrisma.notification.findUnique.mockResolvedValue({ retryCount: 5 })
    mockPrisma.notification.update.mockResolvedValue({})

    await scheduleRetry('notif-2', 'persistent failure')

    expect(mockPrisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isDeadLetter: true }),
      })
    )
  })

  it('does nothing if notification not found', async () => {
    mockPrisma.notification.findUnique.mockResolvedValue(null)
    await scheduleRetry('notif-missing', 'error')
    expect(mockPrisma.notification.update).not.toHaveBeenCalled()
  })
})

describe('processRetries', () => {
  it('retries failed email notifications', async () => {
    const pending = [
      {
        id: 'notif-3',
        message: JSON.stringify({ subject: 'Test Subject', text: 'Test', html: '<p>Test</p>' }),
        retryCount: 1,
        recipient: { email: 'user@empresa.cl', name: 'Usuario' },
        document: { folio: 'SC-001', taskName: 'Tarea' },
      },
    ]
    mockPrisma.notification.findMany.mockResolvedValue(pending)
    mockPrisma.notification.update.mockResolvedValue({})
    vi.mocked(sendEmail).mockResolvedValue({ messageId: 'msg-1', provider: 'mock' })

    const count = await processRetries()

    expect(count).toBe(1)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@empresa.cl', subject: 'Test Subject' })
    )
    expect(mockPrisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SENT' }),
      })
    )
  })

  it('reschedules on send failure', async () => {
    const pending = [
      {
        id: 'notif-4',
        message: JSON.stringify({ subject: 'Test', text: 'Test', html: '<p>Test</p>' }),
        retryCount: 2,
        recipient: { email: 'other@empresa.cl', name: 'Otro' },
        document: { folio: 'SC-002', taskName: 'Otra tarea' },
      },
    ]
    mockPrisma.notification.findMany.mockResolvedValue(pending)
    mockPrisma.notification.findUnique.mockResolvedValue({ retryCount: 2 })
    mockPrisma.notification.update.mockResolvedValue({})
    vi.mocked(sendEmail).mockRejectedValue(new Error('Network error'))

    await processRetries()

    // scheduleRetry is called via the catch
    expect(mockPrisma.notification.update).toHaveBeenCalled()
  })

  it('returns 0 when no retries pending', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([])
    const count = await processRetries()
    expect(count).toBe(0)
  })
})

describe('getDeadLetters', () => {
  it('queries dead letter notifications', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([])
    await getDeadLetters()
    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isDeadLetter: true }) })
    )
  })
})
