import type { AgentConfig, KnowledgeEntry, Message, Product, Service } from './types'
import { buildConversationContext, buildSystemPrompt } from './agentPrompt'
import { AGENDA_TOOLS, HANDOFF_TOOL, PEDIDO_TOOLS, runAgentTool, type ToolContext } from './agentTools'
import { getProvider, type LlmMessage } from './llm'
import { businessNow } from './timezone'

/**
 * Cuántos mensajes de historial se le pasan al modelo. Lo anterior ya está
 * resumido en la ficha del contacto, que va en el contexto: sin este tope,
 * una conversación larga cuesta cada vez más tokens por respuesta.
 */
export const MAX_HISTORY_MESSAGES = 40

/** Lo que se le manda al cliente si el modelo no devolvió nada usable. */
export const FALLBACK_REPLY = 'Dame un momento que lo reviso y te respondo.'

/**
 * Convierte el historial al formato del proveedor:
 * - Los mensajes de una persona del equipo cuentan como del negocio (van
 *   marcados para que el agente sepa que no los escribió él). Antes se
 *   descartaban, y el agente podía contradecir lo que la persona ya había
 *   dicho.
 * - Los mensajes seguidos del mismo lado se juntan en uno: por WhatsApp es
 *   normal mandar "hola" y "quería saber el precio" por separado.
 * - Se toma solo el final del historial y se arranca siempre por un mensaje
 *   del cliente, que es lo que exige la API.
 */
export function toLlmMessages(history: Message[]): LlmMessage[] {
  const merged: Array<{ role: 'user' | 'assistant'; text: string }> = []
  for (const message of history.slice(-MAX_HISTORY_MESSAGES)) {
    const role = message.sender === 'contact' ? 'user' : 'assistant'
    const text = message.sender === 'human' ? `[Equipo] ${message.text}` : message.text
    const last = merged[merged.length - 1]
    if (last && last.role === role) {
      last.text = `${last.text}\n${text}`
    } else {
      merged.push({ role, text })
    }
  }
  while (merged.length > 0 && merged[0].role !== 'user') merged.shift()
  return merged
}

/** Traduce el error del proveedor activo a algo accionable para el panel. */
export function describeApiError(error: unknown): string {
  try {
    return getProvider().describeError(error)
  } catch {
    return error instanceof Error ? error.message : String(error)
  }
}

/** Cuántas veces puede encadenar herramientas antes de tener que contestar. */
const MAX_TOOL_ROUNDS = 4

/**
 * Tope de tokens por respuesta. El prompt ya pide mensajes cortos: esto no es
 * para acortar, es para que el razonamiento del modelo (que también cuenta)
 * no deje la respuesta cortada a la mitad.
 */
const REPLY_MAX_TOKENS = 8000

export async function generateAgentReply(
  config: AgentConfig,
  knowledge: KnowledgeEntry[],
  history: Message[],
  options?: {
    services?: Service[]
    products?: Product[]
    toolContext?: ToolContext
    contactNotes?: string
  },
): Promise<string> {
  const provider = getProvider()
  const services = options?.services ?? []
  const products = options?.products ?? []
  const toolContext = options?.toolContext

  // Cada juego de herramientas se habilita solo si el negocio cargó los datos
  // que necesita. Sin eso el agente contesta normal y dice que confirma después.
  // Derivar a una persona está siempre disponible.
  const tools = toolContext
    ? [
        ...(services.length > 0 ? AGENDA_TOOLS : []),
        ...(products.length > 0 ? PEDIDO_TOOLS : []),
        HANDOFF_TOOL,
      ]
    : []

  const messages = toLlmMessages(history)
  if (messages.length === 0) return FALLBACK_REPLY

  const system = buildSystemPrompt(config, knowledge, services, products)
  const context = buildConversationContext(businessNow(), options?.contactNotes)

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const completion = await provider.complete({
      system,
      context,
      messages,
      maxTokens: REPLY_MAX_TOKENS,
      effort: 'medium',
      ...(tools.length > 0 ? { tools } : {}),
    })

    if (completion.toolCalls.length === 0 || !toolContext) {
      // Una respuesta cortada o vacía no se le manda al cliente así.
      if (completion.incomplete || !completion.text) return FALLBACK_REPLY
      return completion.text
    }

    // Última vuelta: se corta el encadenado y se responde con lo que haya, para
    // no quedar en un ciclo de herramientas sin contestarle nunca al cliente.
    if (round === MAX_TOOL_ROUNDS) {
      return completion.text || FALLBACK_REPLY
    }

    messages.push({
      role: 'assistant_tools',
      text: completion.text,
      calls: completion.toolCalls,
      raw: completion.raw,
    })

    const results = []
    for (const call of completion.toolCalls) {
      const content = await runAgentTool(toolContext, call.name, call.input)
      results.push({ id: call.id, content })
    }

    messages.push({ role: 'tool_results', results })
  }

  return FALLBACK_REPLY
}

const NOTES_SYSTEM_PROMPT = `Analizas una conversación de ventas/atención al cliente y mantienes
una ficha corta con lo que se sabe de ESA persona (no de la empresa). Se te pasa la ficha
anterior y la conversación completa actualizada.

Devuelve SOLO la ficha actualizada, en viñetas cortas (máximo 6), con datos concretos que hayan
salido en la charla: qué necesita, presupuesto, zona/ubicación, urgencia, preferencias,
objeciones, y cualquier dato personal que haya compartido (nombre, ocupación, etc.).

No inventes nada que no esté en la conversación. No repitas la conversación. No agregues
explicaciones ni encabezados, solo las viñetas. Si todavía no hay nada relevante, devuelve "Sin
datos relevantes todavía".`

/**
 * Mantiene una ficha corta del contacto (no del negocio) a partir de la
 * conversación, para que el equipo — y el propio agente en la siguiente
 * respuesta — tengan un resumen de quién es y qué necesita sin releer todo el
 * historial. Falla en silencio: si esto no funciona, no debe romper el envío
 * de la respuesta principal al cliente.
 */
export async function generateContactNotes(
  history: Message[],
  previousNotes: string,
): Promise<string> {
  const provider = getProvider()

  const completion = await provider.complete({
    system: NOTES_SYSTEM_PROMPT,
    maxTokens: 2000,
    effort: 'low',
    messages: [
      ...toLlmMessages(history),
      {
        role: 'user',
        text: `Ficha anterior:\n${previousNotes || '(vacía)'}\n\nActualiza la ficha con la conversación de arriba.`,
      },
    ],
  })

  if (completion.incomplete) return previousNotes
  return completion.text || previousNotes
}
