import nodemailer from 'nodemailer'
import type { EmailProvider, EmailMessage, EmailSendResult } from './types'

export class SmtpEmailProvider implements EmailProvider {
  private readonly from: string

  constructor() {
    this.from = process.env.EMAIL_FROM ?? process.env.SMTP_FROM ?? 'SafeCheck AI <no-reply@safecheck.ai>'
  }

  async send(msg: EmailMessage): Promise<EmailSendResult> {
    const transport = process.env.RESEND_API_KEY
      ? nodemailer.createTransport({
          host: 'smtp.resend.com',
          port: 465,
          secure: true,
          auth: { user: 'resend', pass: process.env.RESEND_API_KEY },
        })
      : nodemailer.createTransport({
          host: process.env.SMTP_HOST ?? 'localhost',
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
            : undefined,
        })

    const info = await transport.sendMail({
      from: msg.from ?? this.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    })

    return { messageId: info.messageId, provider: 'smtp' }
  }
}
