import { appUrl } from './auth'
import { prisma } from './db'
import { newConversationEmail, sendEmail } from './email'
import type { Business, Conversation } from './types'

/**
 * Avisa a los dueños del negocio cuando entra una conversación nueva (no en
 * cada mensaje: eso saturaría de mails a cualquier negocio con algo de
 * tráfico). Best-effort — nunca debe frenar ni fallar el pipeline del
 * agente, que ya le respondió al cliente para cuando esto se llama.
 */
export async function notifyNewConversation(business: Business, conversation: Conversation): Promise<void> {
  const owners = await prisma.businessMember.findMany({
    where: { businessId: business.id, role: 'OWNER' },
    include: { user: { select: { email: true } } },
  })
  if (owners.length === 0) return

  const url = `${appUrl()}/panel/${business.id}/conversaciones/${conversation.id}`
  const { subject, html, text } = newConversationEmail(business.config.businessName, conversation.contactName, url)

  await Promise.all(
    owners.map((o) =>
      sendEmail({ to: o.user.email, subject, html, text }).catch((error) => {
        console.error('[notifications] no se pudo avisar a', o.user.email, error)
      }),
    ),
  )
}
