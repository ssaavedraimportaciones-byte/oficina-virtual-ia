import type { EmailProvider, EmailMessage, EmailSendResult } from './types'

export interface SentEmail extends EmailMessage {
  sentAt: Date
}

/** In-memory provider — for tests and local development. Never sends real email. */
export class MockEmailProvider implements EmailProvider {
  readonly sent: SentEmail[] = []

  async send(msg: EmailMessage): Promise<EmailSendResult> {
    this.sent.push({ ...msg, sentAt: new Date() })
    return { messageId: `mock-${Date.now()}`, provider: 'mock' }
  }

  clear(): void {
    this.sent.length = 0
  }

  lastSent(): SentEmail | undefined {
    return this.sent[this.sent.length - 1]
  }
}
