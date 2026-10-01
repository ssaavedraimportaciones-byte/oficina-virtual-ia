import { BRAND } from './brand'
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

  const from = process.env.EMAIL_FROM || `${BRAND.name} <no-responder@zerovisto.local>`

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

/**
 * El nombre del contacto lo elige quien escribe por WhatsApp/Instagram: sin
 * escapar, alguien puede meter HTML (un link falso) en el mail que le llega
 * al dueño del negocio.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function emailShell(title: string, bodyHtml: string, actionUrl: string, actionLabel: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px;background:#030712;font-family:ui-sans-serif,system-ui,sans-serif;color:#e5e7eb;">
    <div style="max-width:480px;margin:0 auto;">
      <p style="color:#f59e0b;font-weight:600;font-family:monospace;font-size:18px;margin:0 0 24px;">${BRAND.name}</p>
      <h1 style="font-size:20px;margin:0 0 16px;color:#fff;">${title}</h1>
      <div style="font-size:14px;line-height:1.6;color:#d1d5db;">${bodyHtml}</div>
      <a href="${actionUrl}" style="display:inline-block;margin-top:24px;background:#f59e0b;color:#030712;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:6px;font-size:14px;">${actionLabel}</a>
      <p style="margin-top:24px;font-size:12px;color:#6b7280;word-break:break-all;">Si el botón no funciona, copia este link:<br />${actionUrl}</p>
    </div>
  </body>
</html>`
}

export function passwordResetEmail(resetUrl: string) {
  return {
    subject: `Restablecer tu contraseña — ${BRAND.name}`,
    html: emailShell(
      'Restablecer tu contraseña',
      'Pediste restablecer tu contraseña. Este link vale por 1 hora y se puede usar una sola vez. Si no fuiste tú, ignora este mail: tu contraseña actual sigue funcionando.',
      resetUrl,
      'Elegir nueva contraseña',
    ),
    text: `Restablecer tu contraseña: ${resetUrl}\n\nEste link vale por 1 hora. Si no pediste esto, ignora el mail.`,
  }
}

export function verifyEmailMessage(verifyUrl: string) {
  return {
    subject: `Confirma tu email — ${BRAND.name}`,
    html: emailShell(
      'Confirma tu email',
      'Para terminar de activar tu cuenta, confirma que esta es tu casilla. El link vale por 24 horas.',
      verifyUrl,
      'Confirmar email',
    ),
    text: `Confirma tu email: ${verifyUrl}\n\nEste link vale por 24 horas.`,
  }
}

export function newConversationEmail(businessName: string, contactName: string, conversationUrl: string) {
  return {
    subject: `Nueva conversación en ${businessName} — ${BRAND.name}`,
    html: emailShell(
      'Tienes una conversación nueva',
      `<strong>${escapeHtml(contactName)}</strong> te escribió por primera vez en <strong>${escapeHtml(businessName)}</strong>. El agente ya respondió; revisa que haya quedado bien.`,
      conversationUrl,
      'Ver conversación',
    ),
    text: `${contactName} te escribió por primera vez en ${businessName}.\n\nVer conversación: ${conversationUrl}`,
  }
}

export function handoffEmail(
  businessName: string,
  contactName: string,
  reason: string,
  conversationUrl: string,
) {
  return {
    subject: `${contactName} necesita que le responda una persona — ${businessName}`,
    html: emailShell(
      'Una conversación necesita a alguien del equipo',
      `El agente de <strong>${escapeHtml(businessName)}</strong> le pasó la conversación con <strong>${escapeHtml(contactName)}</strong> al equipo y dejó de responder solo.<br /><br />Motivo: ${escapeHtml(reason)}<br /><br />Responde desde el panel; cuando termines puedes volver a activar al agente.`,
      conversationUrl,
      'Responder ahora',
    ),
    text: `El agente le pasó la conversación con ${contactName} (${businessName}) al equipo.\n\nMotivo: ${reason}\n\nResponder: ${conversationUrl}`,
  }
}

export function quotaReachedEmail(
  businessName: string,
  usage: { plan: 'FREE' | 'PRO'; limit: number | null },
  accountUrl: string,
) {
  const upgrade =
    usage.plan === 'FREE'
      ? ' Pasándote al plan PRO el límite sube y el agente vuelve a responder solo.'
      : ' Escríbenos si necesitas aumentar el límite.'
  return {
    subject: `${businessName}: el agente llegó al límite de respuestas de este mes — ${BRAND.name}`,
    html: emailShell(
      'El agente dejó de responder solo',
      `<strong>${escapeHtml(businessName)}</strong> llegó al límite de <strong>${usage.limit}</strong> respuestas automáticas de este mes. Hasta el día 1 los mensajes nuevos se siguen guardando y los clientes reciben un aviso de que una persona los va a contestar, pero el agente no responde.${upgrade}`,
      accountUrl,
      'Ver mi plan',
    ),
    text: `${businessName} llegó al límite de ${usage.limit} respuestas automáticas de este mes. Los mensajes nuevos se guardan pero el agente no responde hasta el día 1.${upgrade}\n\nVer mi plan: ${accountUrl}`,
  }
}
