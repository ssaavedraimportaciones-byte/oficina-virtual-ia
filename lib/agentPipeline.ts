import { generateAgentReply } from './claude'
import {
  appendMessage,
  createConversation,
  findConversationByContact,
  getConfig,
  listKnowledge,
} from './store'
import type { Channel, Conversation } from './types'

interface IncomingMessage {
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
  const config = await getConfig()
  if (!config) {
    throw new Error('El agente todavía no fue configurado en /panel/configurar')
  }

  let conversation = await findConversationByContact(input.channel, input.contactHandle)
  if (!conversation) {
    conversation = await createConversation({
      channel: input.channel,
      contactName: input.contactName,
      contactHandle: input.contactHandle,
    })
  }

  conversation = await appendMessage(conversation.id, {
    sender: 'contact',
    text: input.text,
  })

  const knowledge = await listKnowledge()
  const reply = await generateAgentReply(config, knowledge, conversation.messages)

  conversation = await appendMessage(conversation.id, {
    sender: 'agent',
    text: reply,
  })

  return { conversation, reply }
}
