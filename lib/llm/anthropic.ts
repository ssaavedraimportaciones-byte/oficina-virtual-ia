import Anthropic from '@anthropic-ai/sdk'
import type { LlmCompletion, LlmMessage, LlmProvider, LlmRequest } from './types'

const DEFAULT_MODEL = 'claude-sonnet-5'

/**
 * `output_config.effort` solo existe en los modelos nuevos; en Haiku 4.5 y
 * anteriores la API lo rechaza con un 400, así que ahí directamente no se manda.
 */
export function supportsEffort(model: string): boolean {
  return /(opus|sonnet|fable|mythos)-(4-[678]|5)/.test(model)
}

function toMessages(messages: LlmMessage[]): Anthropic.MessageParam[] {
  return messages.map((message): Anthropic.MessageParam => {
    switch (message.role) {
      case 'user':
        return { role: 'user', content: message.text }
      case 'assistant':
        return { role: 'assistant', content: message.text }
      case 'assistant_tools': {
        // La respuesta original trae los bloques de thinking que precedieron a
        // las llamadas: hay que devolverlos intactos, así que se prefiere eso a
        // reconstruir el turno a partir del texto y las llamadas.
        if (Array.isArray(message.raw)) {
          return { role: 'assistant', content: message.raw as Anthropic.ContentBlockParam[] }
        }
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

function toSystem(request: LlmRequest): Anthropic.TextBlockParam[] {
  // La parte estable (config del negocio, conocimiento, catálogo) se marca
  // para caché: es lo más largo del pedido y se repite idéntica en cada
  // mensaje y en cada vuelta del loop de herramientas. Lo que cambia por
  // conversación va después, así no invalida esa caché.
  const blocks: Anthropic.TextBlockParam[] = [
    { type: 'text', text: request.system, cache_control: { type: 'ephemeral' } },
  ]
  if (request.context) blocks.push({ type: 'text', text: request.context })
  return blocks
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
        system: toSystem(request),
        ...(request.effort && supportsEffort(model)
          ? { output_config: { effort: request.effort } }
          : {}),
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

      // Con max_tokens el texto puede venir cortado a la mitad, y con refusal
      // no hay respuesta: en los dos casos no conviene mandarle eso al cliente.
      const incomplete = response.stop_reason === 'max_tokens' || response.stop_reason === 'refusal'

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
        raw: response.content,
        incomplete,
      }
    },

    describeError(error: unknown): string {
      const status = (error as { status?: number })?.status
      const raw = error instanceof Error ? error.message : String(error)

      if (error instanceof Anthropic.APIConnectionError || /not in allowlist|ENOTFOUND|ECONNREFUSED|fetch failed/i.test(raw)) {
        return 'El servidor no puede conectarse a api.anthropic.com. Revisa la salida a internet o la política de red del hosting.'
      }
      if (error instanceof Anthropic.AuthenticationError || status === 401 || /API key is invalid/i.test(raw)) {
        return 'La API key de Anthropic es inválida. Revisa ANTHROPIC_API_KEY.'
      }
      // La falta de saldo llega como un 400 genérico: no hay clase propia.
      if (/credit balance is too low/i.test(raw)) {
        return 'La cuenta de Anthropic no tiene saldo. Carga créditos en console.anthropic.com (Plans & Billing).'
      }
      if (error instanceof Anthropic.RateLimitError || status === 429) {
        return 'Se alcanzó el límite de uso de Anthropic. Espera un momento y reintenta.'
      }
      if (error instanceof Anthropic.NotFoundError || status === 404) {
        return `El modelo ${model} no está disponible para esta cuenta. Revisa ANTHROPIC_MODEL.`
      }
      if (error instanceof Anthropic.InternalServerError || (status && status >= 500)) {
        return 'Anthropic tuvo un error temporal. Reintenta en un momento.'
      }
      return raw
    },
  }
}
