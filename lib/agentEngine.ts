import type { AgentConfig, KnowledgeEntry, Message, Product, Service } from './types'
import { buildSystemPrompt } from './agentPrompt'
import { AGENDA_TOOLS, PEDIDO_TOOLS, runAgentTool, type ToolContext } from './agentTools'
import { getProvider, type LlmMessage } from './llm'

function toLlmMessages(history: Message[]): LlmMessage[] {
  return history
    .filter((m) => m.sender !== 'human')
    .map((m) =>
      m.sender === 'contact'
        ? ({ role: 'user', text: m.text } as const)
        : ({ role: 'assistant', text: m.text } as const),
    )
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

export async function generateAgentReply(
  config: AgentConfig,
  knowledge: KnowledgeEntry[],
  history: Message[],
  options?: { services?: Service[]; products?: Product[]; toolContext?: ToolContext },
): Promise<string> {
  const provider = getProvider()
  const services = options?.services ?? []
  const products = options?.products ?? []
  const toolContext = options?.toolContext

  // Cada juego de herramientas se habilita solo si el negocio cargó los datos
  // que necesita. Sin eso el agente contesta normal y dice que confirma después.
  const tools = [
    ...(services.length > 0 ? AGENDA_TOOLS : []),
    ...(products.length > 0 ? PEDIDO_TOOLS : []),
  ]
  const toolsEnabled = Boolean(toolContext) && tools.length > 0

  const messages = toLlmMessages(history)
  const system = buildSystemPrompt(config, knowledge, services, products)

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const completion = await provider.complete({
      system,
      messages,
      maxTokens: 600,
      ...(toolsEnabled ? { tools } : {}),
    })

    if (completion.toolCalls.length === 0 || !toolContext) {
      return completion.text
    }

    // Última vuelta: se corta el encadenado y se responde con lo que haya, para
    // no quedar en un ciclo de herramientas sin contestarle nunca al cliente.
    if (round === MAX_TOOL_ROUNDS) {
      return completion.text || 'Dame un segundo que lo confirmo y te aviso.'
    }

    messages.push({
      role: 'assistant_tools',
      text: completion.text,
      calls: completion.toolCalls,
    })

    const results = []
    for (const call of completion.toolCalls) {
      const content = await runAgentTool(toolContext, call.name, call.input)
      results.push({ id: call.id, content })
    }

    messages.push({ role: 'tool_results', results })
  }

  return ''
}

const NOTES_SYSTEM_PROMPT = `Analizás una conversación de ventas/atención al cliente y mantenés
una ficha corta con lo que se sabe de ESA persona (no de la empresa). Se te pasa la ficha
anterior y la conversación completa actualizada.

Devolvé SOLO la ficha actualizada, en viñetas cortas (máximo 6), con datos concretos que hayan
salido en la charla: qué necesita, presupuesto, zona/ubicación, urgencia, preferencias,
objeciones, y cualquier dato personal que haya compartido (nombre, ocupación, etc.).

No inventes nada que no esté en la conversación. No repitas la conversación. No agregues
explicaciones ni encabezados, solo las viñetas. Si todavía no hay nada relevante, devolvé "Sin
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
    maxTokens: 200,
    messages: [
      ...toLlmMessages(history),
      {
        role: 'user',
        text: `Ficha anterior:\n${previousNotes || '(vacía)'}\n\nActualizá la ficha con la conversación de arriba.`,
      },
    ],
  })

  return completion.text || previousNotes
}
