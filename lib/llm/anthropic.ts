import Anthropic from '@anthropic-ai/sdk'
import type { LlmCompletion, LlmMessage, LlmProvider, LlmRequest } from './types'

const DEFAULT_MODEL = 'claude-sonnet-5'

function toMessages(messages: LlmMessage[]): Anthropic.MessageParam[] {
  return messages.map((message) => {
    switch (message.role) {
      case 'user':
        return { role: 'user', content: message.text }
      case 'assistant':
        return { role: 'assistant', content: message.text }
      case 'assistant_tools': {
        const blocks: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> = []
        if (message.text) blocks.push({ type: 'text', text: message.text })
        for (const call of message.calls) {
          blocks.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input })
        }
        return { role: 'assistant', content: blocks }
      }
      case 'tool_results':
        return {
          role: 'user',
          content: message.results.map((result) => ({
            type: 'tool_result' as const,
            tool_use_id: result.id,
            content: result.content,
          })),
        }
    }
  })
}

export function createAnthropicProvider(apiKey: string): LlmProvider {
  const client = new Anthropic({ apiKey })
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL

  return {
    id: 'anthropic',
    model,

    async complete(request: LlmRequest): Promise<LlmCompletion> {
      const response = await client.messages.create({
        model,
        max_tokens: request.maxTokens,
        system: request.system,
        ...(request.tools?.length
          ? {
              tools: request.tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.parameters as Anthropic.Tool.InputSchema,
              })),
            }
          : {}),
        messages: toMessages(request.messages),
      })

      return {
        text: response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('\n')
          .trim(),
        toolCalls: response.content
          .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
          .map((block) => ({
            id: block.id,
            name: block.name,
            input: (block.input ?? {}) as Record<string, unknown>,
          })),
      }
    },

    describeError(error: unknown): string {
      const status = (error as { status?: number })?.status
      const raw = error instanceof Error ? error.message : String(error)

      if (/not in allowlist|ENOTFOUND|ECONNREFUSED|fetch failed/i.test(raw)) {
        return 'El servidor no puede conectarse a api.anthropic.com. Revisá la salida a internet o la política de red del hosting.'
      }
      if (status === 401 || /API key is invalid/i.test(raw)) {
        return 'La API key de Anthropic es inválida. Revisá ANTHROPIC_API_KEY.'
      }
      if (/credit balance is too low/i.test(raw)) {
        return 'La cuenta de Anthropic no tiene saldo. Cargá créditos en console.anthropic.com (Plans & Billing).'
      }
      if (status === 429) {
        return 'Se alcanzó el límite de uso de Anthropic. Esperá un momento y reintentá.'
      }
      if (status === 404) {
        return `El modelo ${model} no está disponible para esta cuenta. Revisá ANTHROPIC_MODEL.`
      }
      if (status && status >= 500) {
        return 'Anthropic tuvo un error temporal. Reintentá en un momento.'
      }
      return raw
    },
  }
}
