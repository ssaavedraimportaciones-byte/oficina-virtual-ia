import { generateAgentReply } from './agentEngine'
import { updateContactNotes } from './contactNotes'
import { notifyNewConversation } from './notifications'
import {
  appendMessage,
  createConversation,
  findConversationByContact,
  listKnowledge,
  listProducts,
  listServices,
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
  const isNewConversation = !conversation
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

  const [knowledge, services, products] = await Promise.all([
    listKnowledge(business.id),
    listServices(business.id),
    listProducts(business.id),
  ])
  const reply = await generateAgentReply(business.config, knowledge, conversation.messages, {
    services,
    products,
    toolContext: { business, conversation },
  })

  conversation = await appendMessage(conversation.id, {
    sender: 'agent',
    text: reply,
  })

  conversation = await updateContactNotes(conversation)

  if (isNewConversation) {
    await notifyNewConversation(business, conversation).catch(() => {})
  }

  return { conversation, reply }
}
