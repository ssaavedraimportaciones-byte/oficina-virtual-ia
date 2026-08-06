import Anthropic from '@anthropic-ai/sdk'
import type { AgentConfig, KnowledgeEntry, Message, Product, Service } from './types'
import { buildSystemPrompt } from './agentPrompt'
import { AGENDA_TOOLS, PEDIDO_TOOLS, runAgentTool, type ToolContext } from './agentTools'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'Falta ANTHROPIC_API_KEY. Configurala en .env.local para que el agente pueda responder.',
    )
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

function model(): string {
  return process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'
}

/**
 * Traduce los errores de la API a algo accionable. Son los que aparecen en la
 * práctica y el JSON crudo de la API no le dice nada a quien administra el panel.
 */
export function describeApiError(error: unknown): string {
  const status = (error as { status?: number })?.status
  const raw = error instanceof Error ? error.message : String(error)

  if (status === 401 || /API key is invalid/i.test(raw)) {
    return 'La API key de Anthropic es inválida. Revisá ANTHROPIC_API_KEY.'
  }
  if (/credit balance is too low/i.test(raw)) {
    return 'La cuenta de Anthropic no tiene saldo. Cargá créditos en console.anthropic.com (Plans & Billing) para que el agente pueda responder.'
  }
  if (status === 429) {
    return 'Se alcanzó el límite de uso de la API de Anthropic. Esperá un momento y reintentá.'
  }
  if (status === 404 || /model/i.test(raw)) {
    return `El modelo configurado (${model()}) no está disponible para esta cuenta. Revisá ANTHROPIC_MODEL.`
  }
  if (status && status >= 500) {
    return 'La API de Anthropic tuvo un error temporal. Reintentá en un momento.'
  }
  return raw
}

function toAnthropicMessages(history: Message[]): Anthropic.MessageParam[] {
  return history
    .filter((m) => m.sender !== 'human')
    .map((m) => ({
      role: m.sender === 'contact' ? ('user' as const) : ('assistant' as const),
      content: m.text,
    }))
}

function textOf(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

/** Cuántas veces puede encadenar herramientas antes de tener que contestar. */
const MAX_TOOL_ROUNDS = 4

export async function generateAgentReply(
  config: AgentConfig,
  knowledge: KnowledgeEntry[],
  history: Message[],
  options?: { services?: Service[]; products?: Product[]; toolContext?: ToolContext },
): Promise<string> {
  const anthropic = getClient()
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

  const messages = toAnthropicMessages(history)

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const response = await anthropic.messages.create({
      model: model(),
      max_tokens: 600,
      system: buildSystemPrompt(config, knowledge, services, products),
      ...(toolsEnabled ? { tools } : {}),
      messages,
    })

    if (response.stop_reason !== 'tool_use' || !toolContext) {
      return textOf(response)
    }

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    )

    // Última vuelta: se corta el encadenado y se le pide que responda con lo
    // que ya tiene, para no quedar en un ciclo de herramientas sin respuesta.
    if (round === MAX_TOOL_ROUNDS) {
      return textOf(response) || 'Dame un segundo que lo confirmo y te aviso.'
    }

    messages.push({ role: 'assistant', content: response.content })

    const results: Anthropic.ToolResultBlockParam[] = []
    for (const toolUse of toolUses) {
      const output = await runAgentTool(
        toolContext,
        toolUse.name,
        (toolUse.input ?? {}) as Record<string, unknown>,
      )
      results.push({ type: 'tool_result', tool_use_id: toolUse.id, content: output })
    }

    messages.push({ role: 'user', content: results })
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
  const anthropic = getClient()

  const response = await anthropic.messages.create({
    model: model(),
    max_tokens: 200,
    system: NOTES_SYSTEM_PROMPT,
    messages: [
      ...toAnthropicMessages(history),
      {
        role: 'user',
        content: `Ficha anterior:\n${previousNotes || '(vacía)'}\n\nActualizá la ficha con la conversación de arriba.`,
      },
    ],
  })

  return textOf(response) || previousNotes
}
