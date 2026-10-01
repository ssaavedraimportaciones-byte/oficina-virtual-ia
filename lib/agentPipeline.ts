import { generateAgentReply } from './agentEngine'
import { updateContactNotes } from './contactNotes'
import { notifyNewConversation, notifyQuotaReached } from './notifications'
import { getMaintenance } from './platform'
import { rateLimit } from './rateLimit'
import {
  appendIncomingMessage,
  appendMessage,
  findOrCreateConversation,
  getConversation,
  listKnowledge,
  listProducts,
  listServices,
} from './store'
import type { Business, Channel, Conversation } from './types'
import { getAgentUsage, QUOTA_REPLY } from './usage'

interface IncomingMessage {
  business: Business
  channel: Channel
  contactHandle: string
  contactName: string
  text: string
  /** ID del mensaje en Meta, para no procesar dos veces un reintento del webhook. */
  externalId?: string
}

interface PipelineDeps {
  /** Manda la respuesta por el canal (WhatsApp, Instagram). */
  send: (text: string) => Promise<void>
  /**
   * Corre trabajo que no tiene que demorar la respuesta al cliente (la ficha
   * del contacto, el mail al dueño). En los webhooks es `after()` de Next;
   * por defecto se espera en el momento.
   */
  defer?: (task: () => Promise<void>) => void
  /** Ver AGENT_DEBOUNCE_MS. */
  debounceMs?: number
}

export type IncomingResult =
  | { status: 'duplicate' }
  | { status: 'paused'; conversation: Conversation }
  | { status: 'superseded'; conversation: Conversation }
  | { status: 'quota'; conversation: Conversation }
  | { status: 'maintenance'; conversation: Conversation }
  | { status: 'degraded'; conversation: Conversation }
  | { status: 'replied'; conversation: Conversation; reply: string }

/**
 * Por WhatsApp la gente escribe en ráfagas: "hola", "quería saber", "cuánto
 * sale el semi". Sin esperar un poco, el agente contesta tres veces por
 * separado. Se espera este tiempo y, si mientras tanto entró otro mensaje, se
 * deja que conteste la ejecución de ese último (que ve toda la ráfaga).
 */
function defaultDebounceMs(): number {
  const configured = Number(process.env.AGENT_DEBOUNCE_MS)
  return Number.isFinite(configured) && configured >= 0 ? configured : 2500
}

function lastContactMessageId(conversation: Conversation): string | undefined {
  for (let i = conversation.messages.length - 1; i >= 0; i -= 1) {
    if (conversation.messages[i].sender === 'contact') return conversation.messages[i].id
  }
  return undefined
}

/**
 * Registra el mensaje entrante y, si corresponde, genera la respuesta del
 * agente, la manda por el canal y la guarda. El envío lo hace quien llama
 * (`deps.send`), para no acoplar el pipeline a WhatsApp/Instagram.
 */
export async function handleIncomingMessage(
  input: IncomingMessage,
  deps: PipelineDeps,
): Promise<IncomingResult> {
  const { business } = input
  const inline: Promise<void>[] = []
  const defer = deps.defer ?? ((task) => void inline.push(task()))
  const debounceMs = deps.debounceMs ?? defaultDebounceMs()

  const { conversation: found, created } = await findOrCreateConversation({
    businessId: business.id,
    channel: input.channel,
    contactName: input.contactName,
    contactHandle: input.contactHandle,
  })

  const saved = await appendIncomingMessage(found.id, input.text, input.externalId)
  if (!saved) return { status: 'duplicate' }
  let conversation = saved.conversation

  // Una persona tomó la conversación: el mensaje queda guardado para que lo
  // vea en el panel, pero el agente no se mete.
  if (conversation.agentPaused) return { status: 'paused', conversation }

  if (debounceMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, debounceMs))
    conversation = (await getConversation(conversation.id)) ?? conversation
    if (conversation.agentPaused) return { status: 'paused', conversation }
    if (lastContactMessageId(conversation) !== saved.messageId) {
      return { status: 'superseded', conversation }
    }
  }

  /**
   * Le manda al cliente un texto fijo, sin llamar a la IA, salvo que sea el
   * mismo que ya recibió como último mensaje nuestro: no se repite en cada
   * mensaje que escriba mientras tanto.
   */
  async function sendCanned(text: string): Promise<void> {
    const lastFromUs = [...conversation.messages].reverse().find((m) => m.sender !== 'contact')
    if (lastFromUs?.text === text) return
    await deps.send(text)
    conversation = await appendMessage(conversation.id, { sender: 'agent', text })
  }

  // Modo mantenimiento (lo prende el dueño de la plataforma): el agente no
  // responde en ninguna empresa. Los mensajes se guardan igual y el cliente no
  // queda en visto: recibe el aviso de mantenimiento.
  const maintenance = await getMaintenance()
  if (maintenance.enabled) {
    await sendCanned(maintenance.message)
    return { status: 'maintenance', conversation }
  }

  // Cupo mensual de la empresa: si se agotó, no se llama a la IA (cuesta plata
  // de la plataforma). Al cliente no se lo deja en visto: recibe un aviso de
  // que una persona lo va a contestar, una sola vez, y el dueño recibe un mail.
  const usage = await getAgentUsage(business.id)
  if (usage.exceeded) {
    await sendCanned(QUOTA_REPLY)
    const firstTime = await rateLimit(`quota:${business.id}:${usage.month}`, 1, 32 * 24 * 60 * 60 * 1000)
    if (firstTime.allowed) {
      defer(async () => {
        await notifyQuotaReached(business, usage).catch((error) => {
          console.error('[pipeline] no se pudo avisar que se agotó el cupo:', error)
        })
      })
    }
    await Promise.all(inline)
    return { status: 'quota', conversation }
  }

  const [knowledge, services, products] = await Promise.all([
    listKnowledge(business.id),
    listServices(business.id),
    listProducts(business.id),
  ])
  let reply: string
  try {
    reply = await generateAgentReply(business.config, knowledge, conversation.messages, {
      services,
      products,
      toolContext: { business, conversation },
      contactNotes: conversation.notes,
    })
  } catch (error) {
    // La IA falló (caída del proveedor, sin saldo, límite de uso…). Antes el
    // cliente se quedaba sin respuesta; ahora recibe el mensaje de contingencia
    // y el error queda en los logs para quien administra la plataforma.
    console.error('[pipeline] falló la IA, se responde con el mensaje de contingencia:', error)
    await sendCanned((await getMaintenance()).message)
    return { status: 'degraded', conversation }
  }

  // Se guarda recién cuando salió: si el envío falla, en el panel no tiene
  // que figurar como contestado.
  await deps.send(reply)
  conversation = await appendMessage(conversation.id, { sender: 'agent', text: reply })

  const answered = conversation
  defer(async () => {
    await updateContactNotes(answered)
    if (created) {
      await notifyNewConversation(business, answered).catch((error) => {
        console.error('[pipeline] no se pudo avisar la conversación nueva:', error)
      })
    }
  })

  await Promise.all(inline)
  return { status: 'replied', conversation, reply }
}
