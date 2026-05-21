import { prisma } from '@/lib/db/client'
import { sendEmail } from './channels/email'
import { sendWhatsAppText, isWhatsAppConfigured } from './channels/whatsapp'
import { renderTemplate } from './templates'
import { getRecipientsForEvent } from './recipients'
import { log } from '@/modules/audit'
import type { AuditCtx } from '@/modules/audit'
import type {
  NotificationEvent,
  NotificationPayload,
  RecipientInfo,
  SendResult,
  NotificationRecord,
  ChannelType,
} from './types'

export type { NotificationEvent, NotificationPayload, SendResult, NotificationRecord }

// ── sendNotification ──────────────────────────────────────────────────────────
/**
 * Sends a single notification over one channel to one recipient.
 * Logs the attempt in the DB regardless of outcome.
 * Never throws — failures are recorded and returned.
 */
export async function sendNotification(
  payload: NotificationPayload,
  recipient: RecipientInfo,
  channel: ChannelType
): Promise<SendResult> {
  const templateCtx = {
    folio: payload.folio,
    taskName: payload.taskName,
    workArea: payload.workArea,
    initiatorName: payload.initiatorName,
    comment: payload.comment,
  }

  let messageJson: string | null = null
  let success = false
  let errorMessage: string | undefined

  try {
    if (channel === 'EMAIL') {
      const tmpl = renderTemplate(payload.event, 'EMAIL', templateCtx)
      messageJson = JSON.stringify({ subject: tmpl.subject, preview: tmpl.text.slice(0, 200) })
      await sendEmail({ to: recipient.email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text })
      success = true
    } else if (channel === 'SMS') {
      const phone = recipient.phone
      if (!phone) throw new Error(`Recipient ${recipient.id} has no phone number`)

      const tmpl = renderTemplate(payload.event, 'SMS', templateCtx)
      messageJson = JSON.stringify({ subType: 'SMS', body: tmpl.text })
      // Future: integrate SMS provider (e.g. Twilio)
      throw new Error('SMS provider not configured')
    } else if (channel === 'IN_APP') {
      const tmpl = renderTemplate(payload.event, 'SMS', templateCtx)
      messageJson = JSON.stringify({ subType: 'IN_APP', body: tmpl.text })
      success = true // IN_APP is stored in DB only — no external call
    } else {
      throw new Error(`Channel ${channel} not supported`)
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
  }

  const record = await prisma.notification.create({
    data: {
      documentId: payload.documentId,
      recipientId: recipient.id,
      channel: channel as 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP',
      status: success ? 'SENT' : 'FAILED',
      message: messageJson,
      sentAt: success ? new Date() : null,
    },
  })

  return {
    channel,
    recipientId: recipient.id,
    success,
    error: errorMessage,
    notificationId: record.id,
  }
}

// ── notify ────────────────────────────────────────────────────────────────────
/**
 * Main entry point. Fans out the notification to all relevant recipients
 * across configured channels (EMAIL + WhatsApp if configured + IN_APP).
 * Fire-and-forget safe — caller should use .catch(console.error).
 */
export async function notify(
  payload: NotificationPayload,
  options: { excludeIds?: string[]; auditCtx?: AuditCtx } = {}
): Promise<SendResult[]> {
  const recipients = await getRecipientsForEvent(
    payload.event,
    payload.documentId,
    options.excludeIds
  )

  if (recipients.length === 0) return []

  const results: SendResult[] = []

  for (const recipient of recipients) {
    // Always attempt EMAIL
    const emailResult = await sendNotification(payload, recipient, 'EMAIL')
    results.push(emailResult)

    // WhatsApp via SMS channel if configured and recipient has phone
    if (isWhatsAppConfigured() && recipient.phone) {
      try {
        const tmpl = renderTemplate(payload.event, 'SMS', {
          folio: payload.folio,
          taskName: payload.taskName,
          workArea: payload.workArea,
          initiatorName: payload.initiatorName,
          comment: payload.comment,
        })
        await sendWhatsAppText({ to: recipient.phone, body: tmpl.text })

        const waRecord = await prisma.notification.create({
          data: {
            documentId: payload.documentId,
            recipientId: recipient.id,
            channel: 'SMS',
            status: 'SENT',
            message: JSON.stringify({ subType: 'WHATSAPP', body: tmpl.text }),
            sentAt: new Date(),
          },
        })
        results.push({ channel: 'SMS', recipientId: recipient.id, success: true, notificationId: waRecord.id })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        const waRecord = await prisma.notification.create({
          data: {
            documentId: payload.documentId,
            recipientId: recipient.id,
            channel: 'SMS',
            status: 'FAILED',
            message: JSON.stringify({ subType: 'WHATSAPP', error: errorMsg }),
            sentAt: null,
          },
        })
        results.push({
          channel: 'SMS',
          recipientId: recipient.id,
          success: false,
          error: errorMsg,
          notificationId: waRecord.id,
        })
      }
    }

    // IN_APP notification (DB-only, always succeeds)
    await sendNotification(payload, recipient, 'IN_APP')
  }

  if (options.auditCtx) {
    const failed = results.filter((r) => !r.success)
    const sent   = results.filter((r) => r.success)
    if (sent.length > 0) {
      await log(options.auditCtx, 'NOTIFICATION_SENT', {
        documentId: payload.documentId,
        metadata: { event: payload.event, folio: payload.folio, recipientCount: sent.length },
      })
    }
    for (const f of failed) {
      await log(options.auditCtx, 'NOTIFICATION_FAILED', {
        documentId: payload.documentId,
        metadata: { event: payload.event, folio: payload.folio, channel: f.channel, error: f.error },
      })
    }
  }

  return results
}

// ── getFailedNotifications ────────────────────────────────────────────────────
export async function getFailedNotifications(
  documentId: string
): Promise<NotificationRecord[]> {
  const records = await prisma.notification.findMany({
    where: { documentId, status: 'FAILED' },
    orderBy: { createdAt: 'desc' },
    include: {
      recipient: { select: { name: true, email: true } },
      document: { select: { folio: true, taskName: true } },
    },
  })

  return records.map((r) => ({
    id: r.id,
    documentId: r.documentId,
    recipientId: r.recipientId,
    channel: r.channel as ChannelType,
    status: r.status as 'PENDING' | 'SENT' | 'FAILED' | 'READ',
    message: r.message,
    sentAt: r.sentAt,
    createdAt: r.createdAt,
    recipient: r.recipient,
    document: r.document,
  }))
}
