import { prisma } from '@/lib/db/client'
import { sendEmail } from '@/lib/email'
import { renderTemplate } from './templates'
import type { NotificationEvent } from './types'

const MAX_RETRIES = 5
const BACKOFF_BASE_MS = 60_000 // 1 minute base

function backoffMs(retryCount: number): number {
  // exponential: 1m, 2m, 4m, 8m, 16m
  return BACKOFF_BASE_MS * Math.pow(2, retryCount)
}

// Marks a failed notification for retry with exponential backoff.
// Called by sendNotification on email failure.
export async function scheduleRetry(notificationId: string, error: string): Promise<void> {
  const record = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { retryCount: true },
  })
  if (!record) return

  const newRetryCount = (record.retryCount ?? 0) + 1
  if (newRetryCount > MAX_RETRIES) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { isDeadLetter: true, lastError: error, status: 'FAILED' },
    })
    return
  }

  const nextRetryAt = new Date(Date.now() + backoffMs(newRetryCount))
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      retryCount: newRetryCount,
      nextRetryAt,
      lastError: error,
      status: 'FAILED',
    },
  })
}

// Processes pending retries. Call from a cron or Inngest scheduled job.
// Returns number of retries attempted.
export async function processRetries(): Promise<number> {
  const pending = await prisma.notification.findMany({
    where: {
      status: 'FAILED',
      isDeadLetter: false,
      nextRetryAt: { lte: new Date() },
      channel: 'EMAIL',
    },
    include: {
      recipient: { select: { email: true, name: true } },
      document: { select: { folio: true, taskName: true, workArea: true } },
    },
    take: 50,
  })

  let attempted = 0
  for (const n of pending) {
    if (!n.recipient.email) continue
    attempted++

    try {
      const messageData = n.message ? JSON.parse(n.message) : null
      if (!messageData?.subject) {
        await prisma.notification.update({
          where: { id: n.id },
          data: { isDeadLetter: true, lastError: 'missing subject in stored message' },
        })
        continue
      }

      await sendEmail({
        to: n.recipient.email,
        subject: messageData.subject,
        html: messageData.html ?? messageData.subject,
        text: messageData.text ?? messageData.subject,
      })

      await prisma.notification.update({
        where: { id: n.id },
        data: { status: 'SENT', sentAt: new Date(), lastError: null, nextRetryAt: null },
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      await scheduleRetry(n.id, error)
    }
  }

  return attempted
}

// Returns dead-letter notifications (give up queue)
export async function getDeadLetters(companyId?: string) {
  return prisma.notification.findMany({
    where: {
      isDeadLetter: true,
      ...(companyId ? { document: { companyId } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      channel: true,
      lastError: true,
      retryCount: true,
      createdAt: true,
      recipient: { select: { name: true, email: true } },
      document: { select: { folio: true } },
    },
  })
}
