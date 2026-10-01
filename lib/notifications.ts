import { appUrl } from './auth'
import { prisma } from './db'
import { handoffEmail, newConversationEmail, quotaReachedEmail, sendEmail } from './email'
import type { AgentUsage } from './usage'
import type { Business, Conversation } from './types'

/**
 * Avisa a los dueños del negocio cuando entra una conversación nueva (no en
 * cada mensaje: eso saturaría de mails a cualquier negocio con algo de
 * tráfico). Best-effort — nunca debe frenar ni fallar el pipeline del
 * agente, que ya le respondió al cliente para cuando esto se llama.
 */
export async function notifyNewConversation(business: Business, conversation: Conversation): Promise<void> {
  const url = `${appUrl()}/panel/${business.id}/conversaciones/${conversation.id}`
  await emailOwners(
    business.id,
    newConversationEmail(business.config.businessName, conversation.contactName, url),
  )
}

/**
 * Avisa que el agente derivó una conversación. A diferencia de una
 * conversación nueva, acá el cliente está esperando a una persona: si nadie
 * se entera, queda sin respuesta.
 */
export async function notifyHandoff(
  business: Business,
  conversation: Conversation,
  reason: string,
): Promise<void> {
  const url = `${appUrl()}/panel/${business.id}/conversaciones/${conversation.id}`
  await emailOwners(
    business.id,
    handoffEmail(business.config.businessName, conversation.contactName, reason, url),
  )
}

/**
 * Avisa que se agotó el cupo mensual de respuestas del agente. Es de las pocas
 * notificaciones que el dueño tiene que ver sí o sí: el agente dejó de
 * contestar y sus clientes están esperando.
 */
export async function notifyQuotaReached(business: Business, usage: AgentUsage): Promise<void> {
  await emailOwners(
    business.id,
    quotaReachedEmail(business.config.businessName, usage, `${appUrl()}/account`),
  )
}

async function emailOwners(
  businessId: string,
  { subject, html, text }: { subject: string; html: string; text: string },
): Promise<void> {
  const owners = await prisma.businessMember.findMany({
    where: { businessId, role: 'OWNER' },
    include: { user: { select: { email: true } } },
  })
  if (owners.length === 0) return

  await Promise.all(
    owners.map((o) =>
      sendEmail({ to: o.user.email, subject, html, text }).catch((error) => {
        console.error('[notifications] no se pudo avisar a', o.user.email, error)
      }),
    ),
  )
}
