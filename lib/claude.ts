import Anthropic from '@anthropic-ai/sdk'
import type { AgentConfig, KnowledgeEntry, Message } from './types'
import { buildSystemPrompt } from './agentPrompt'

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

function toAnthropicMessages(history: Message[]) {
  return history
    .filter((m) => m.sender !== 'human')
    .map((m) => ({
      role: m.sender === 'contact' ? ('user' as const) : ('assistant' as const),
      content: m.text,
    }))
}

export async function generateAgentReply(
  config: AgentConfig,
  knowledge: KnowledgeEntry[],
  history: Message[],
): Promise<string> {
  const anthropic = getClient()
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'

  const response = await anthropic.messages.create({
    model,
    max_tokens: 400,
    system: buildSystemPrompt(config, knowledge),
    messages: toAnthropicMessages(history),
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  return textBlock && textBlock.type === 'text' ? textBlock.text : ''
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
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'

  const response = await anthropic.messages.create({
    model,
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

  const textBlock = response.content.find((block) => block.type === 'text')
  return textBlock && textBlock.type === 'text' ? textBlock.text.trim() : previousNotes
}
