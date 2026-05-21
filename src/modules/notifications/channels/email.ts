import nodemailer from 'nodemailer'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text: string
}

function createTransport() {
  // Resend SMTP relay (optional — falls back to generic SMTP)
  if (process.env.RESEND_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: { user: 'resend', pass: process.env.RESEND_API_KEY },
    })
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
        : undefined,
  })
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  const from = process.env.SMTP_FROM ?? 'SafeCheck AI <no-reply@safecheck.ai>'
  const transport = createTransport()
  await transport.sendMail({ from, ...opts })
}
