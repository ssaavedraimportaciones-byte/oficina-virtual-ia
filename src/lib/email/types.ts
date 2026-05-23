export interface EmailMessage {
  to: string
  from?: string
  subject: string
  html: string
  text: string
}

export interface EmailSendResult {
  messageId?: string
  provider: string
}

export interface EmailProvider {
  send(msg: EmailMessage): Promise<EmailSendResult>
}
