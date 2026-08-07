import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Envío de mail vía SMTP genérico: funciona con cualquier proveedor (Gmail,
 * SES, Resend, Postmark, Mailgun, tu propio servidor) sin atarse a un SDK de
 * uno en particular. Si no está configurado, sendEmail no explota — devuelve
 * { sent: false } y quien llama decide qué hacer (ver lib/auth.ts: los flujos
 * de recuperación/verificación son best-effort a propósito).
 */

let transporter: Transporter | null | undefined

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST)
}

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter
  if (!emailConfigured()) {
    transporter = null
    return transporter
  }

  const host = process.env.SMTP_HOST as string
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  transporter = nodemailer.createTransport({
    host,
    port,
    // 465 es el puerto estándar de SMTPS (TLS implícito); el resto asume STARTTLS.
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  })
  return transporter
}

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  text: string
}

export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean }> {
  const transport = getTransporter()
  if (!transport) return { sent: false }

  const from = process.env.EMAIL_FROM || 'AgentsApp <no-responder@agentsapp.local>'

  try {
    await transport.sendMail({ from, ...input })
    return { sent: true }
  } catch (error) {
    // Best-effort: quien llama no debe romperse porque el SMTP falló, pero
    // conviene que quede en los logs del servidor para poder diagnosticarlo.
    console.error('[email] no se pudo enviar:', error)
    return { sent: false }
  }
}

function emailShell(title: string, bodyHtml: string, actionUrl: string, actionLabel: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px;background:#030712;font-family:ui-sans-serif,system-ui,sans-serif;color:#e5e7eb;">
    <div style="max-width:480px;margin:0 auto;">
      <p style="color:#f59e0b;font-weight:600;font-family:monospace;font-size:18px;margin:0 0 24px;">AgentsApp</p>
      <h1 style="font-size:20px;margin:0 0 16px;color:#fff;">${title}</h1>
      <div style="font-size:14px;line-height:1.6;color:#d1d5db;">${bodyHtml}</div>
      <a href="${actionUrl}" style="display:inline-block;margin-top:24px;background:#f59e0b;color:#030712;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:6px;font-size:14px;">${actionLabel}</a>
      <p style="margin-top:24px;font-size:12px;color:#6b7280;word-break:break-all;">Si el botón no funciona, copiá este link:<br />${actionUrl}</p>
    </div>
  </body>
</html>`
}

export function passwordResetEmail(resetUrl: string) {
  return {
    subject: 'Restablecer tu contraseña — AgentsApp',
    html: emailShell(
      'Restablecer tu contraseña',
      'Pediste restablecer tu contraseña. Este link vale por 1 hora y se puede usar una sola vez. Si no fuiste vos, ignorá este mail: tu contraseña actual sigue funcionando.',
      resetUrl,
      'Elegir nueva contraseña',
    ),
    text: `Restablecer tu contraseña: ${resetUrl}\n\nEste link vale por 1 hora. Si no pediste esto, ignorá el mail.`,
  }
}

export function verifyEmailMessage(verifyUrl: string) {
  return {
    subject: 'Confirmá tu email — AgentsApp',
    html: emailShell(
      'Confirmá tu email',
      'Para terminar de activar tu cuenta, confirmá que esta es tu casilla. El link vale por 24 horas.',
      verifyUrl,
      'Confirmar email',
    ),
    text: `Confirmá tu email: ${verifyUrl}\n\nEste link vale por 24 horas.`,
  }
}
