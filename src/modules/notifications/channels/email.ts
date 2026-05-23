import { sendEmail as sendViaProvider } from '@/lib/email'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text: string
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  await sendViaProvider(opts)
}
