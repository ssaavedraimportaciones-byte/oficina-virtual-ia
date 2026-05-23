import type { EmailProvider, EmailMessage, EmailSendResult } from './types'
export type { EmailProvider, EmailMessage, EmailSendResult }
export { MockEmailProvider } from './mock'

let _provider: EmailProvider | null = null

export function setEmailProvider(p: EmailProvider): void {
  _provider = p
}

/** Visible for testing */
export function _resetEmailProviderForTest(): void {
  _provider = null
}

function getProvider(): EmailProvider {
  if (_provider) return _provider

  const mode = process.env.EMAIL_PROVIDER ?? 'smtp'

  if (mode === 'resend') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ResendEmailProvider } = require('./resend') as typeof import('./resend')
    _provider = new ResendEmailProvider()
  } else if (mode === 'mock') {
    const { MockEmailProvider } = require('./mock') as typeof import('./mock')
    _provider = new MockEmailProvider()
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SmtpEmailProvider } = require('./smtp') as typeof import('./smtp')
    _provider = new SmtpEmailProvider()
  }

  return _provider
}

export async function sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
  return getProvider().send(msg)
}
