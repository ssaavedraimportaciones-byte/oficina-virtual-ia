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
    messages: history
      .filter((m) => m.sender !== 'human')
      .map((m) => ({
        role: m.sender === 'contact' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      })),
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  return textBlock && textBlock.type === 'text' ? textBlock.text : ''
}
