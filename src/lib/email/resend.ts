import { Resend } from 'resend'
import type { EmailProvider, EmailMessage, EmailSendResult } from './types'

export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend
  private readonly from: string

  constructor() {
    this.client = new Resend(process.env.RESEND_API_KEY!)
    this.from = process.env.EMAIL_FROM ?? 'SafeCheck AI <no-reply@safecheck.ai>'
  }

  async send(msg: EmailMessage): Promise<EmailSendResult> {
    const { data, error } = await this.client.emails.send({
      from: msg.from ?? this.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    })

    if (error) throw new Error(`Resend error: ${error.message}`)
    return { messageId: data?.id, provider: 'resend' }
  }
}
