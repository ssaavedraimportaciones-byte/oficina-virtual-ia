import { sendInstagramMessage } from './instagram'
import { appendMessage, decryptCredentials, setAgentPaused } from './store'
import type { Business, Conversation } from './types'
import { sendWhatsAppMessage } from './whatsapp'

/**
 * Una persona del equipo le responde al contacto desde el panel. El mensaje
 * sale de verdad por el canal (antes solo se guardaba, y el cliente nunca lo
 * recibía) y el agente queda en pausa en esa conversación, para que no se
 * cruce con la persona. Se reactiva a mano desde el panel.
 *
 * Si el envío falla, tira el error y no guarda nada: en el panel no tiene
 * que figurar un mensaje que el cliente no recibió.
 */
export async function sendHumanReply(
  business: Business,
  conversation: Conversation,
  text: string,
): Promise<Conversation> {
  const credentials = decryptCredentials(business.credentials)
  if (conversation.channel === 'whatsapp') {
    await sendWhatsAppMessage(conversation.contactHandle, text, credentials)
  } else if (conversation.channel === 'instagram') {
    await sendInstagramMessage(conversation.contactHandle, text, credentials)
  }

  await appendMessage(conversation.id, { sender: 'human', text })
  return setAgentPaused(
    conversation.id,
    true,
    conversation.agentPaused && conversation.handoffReason
      ? conversation.handoffReason
      : 'Respondió una persona del equipo.',
  )
}
