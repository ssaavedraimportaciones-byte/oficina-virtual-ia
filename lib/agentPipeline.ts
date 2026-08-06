import { generateAgentReply } from './claude'
import { updateContactNotes } from './contactNotes'
import {
  appendMessage,
  createConversation,
  findConversationByContact,
  listKnowledge,
} from './store'
import type { Business, Channel, Conversation } from './types'

interface IncomingMessage {
  business: Business
  channel: Channel
  contactHandle: string
  contactName: string
  text: string
}

/**
 * Registra el mensaje entrante, genera la respuesta del agente con Claude y la
 * guarda en la conversación. No envía nada al canal externo — eso lo hace
 * cada webhook después de llamar a esta función, para no acoplar el pipeline
 * a WhatsApp/Instagram.
 */
export async function handleIncomingMessage(
  input: IncomingMessage,
): Promise<{ conversation: Conversation; reply: string }> {
  const { business } = input

  let conversation = await findConversationByContact(
    business.id,
    input.channel,
    input.contactHandle,
  )
  if (!conversation) {
    conversation = await createConversation({
      businessId: business.id,
      channel: input.channel,
      contactName: input.contactName,
      contactHandle: input.contactHandle,
    })
  }

  conversation = await appendMessage(conversation.id, {
    sender: 'contact',
    text: input.text,
  })

  const knowledge = await listKnowledge(business.id)
  const reply = await generateAgentReply(business.config, knowledge, conversation.messages)

  conversation = await appendMessage(conversation.id, {
    sender: 'agent',
    text: reply,
  })

  conversation = await updateContactNotes(conversation)

  return { conversation, reply }
}
