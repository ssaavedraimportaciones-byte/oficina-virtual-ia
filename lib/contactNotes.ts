import { generateContactNotes } from './claude'
import { setConversationNotes } from './store'
import type { Conversation } from './types'

/**
 * Actualiza la ficha del contacto en base a la conversación. Es best-effort:
 * si Claude falla acá, no debe tirar abajo el envío de la respuesta principal
 * al cliente, así que cualquier error se ignora y se devuelve la conversación
 * tal cual estaba.
 */
export async function updateContactNotes(conversation: Conversation): Promise<Conversation> {
  try {
    const notes = await generateContactNotes(conversation.messages, conversation.notes)
    return await setConversationNotes(conversation.id, notes)
  } catch {
    return conversation
  }
}
