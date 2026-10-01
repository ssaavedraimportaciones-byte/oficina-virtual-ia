import OpenAI from 'openai'
import type { LlmCompletion, LlmMessage, LlmProvider, LlmRequest } from './types'

const DEFAULT_MODEL = 'gpt-4o'

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam

function toMessages(system: string, messages: LlmMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [{ role: 'system', content: system }]

  for (const message of messages) {
    switch (message.role) {
      case 'user':
        result.push({ role: 'user', content: message.text })
        break
      case 'assistant':
        result.push({ role: 'assistant', content: message.text })
        break
      case 'assistant_tools':
        result.push({
          role: 'assistant',
          content: message.text || null,
          tool_calls: message.calls.map((call) => ({
            id: call.id,
            type: 'function',
            function: { name: call.name, arguments: JSON.stringify(call.input) },
          })),
        })
        break
      case 'tool_results':
        // OpenAI espera un mensaje por cada tool call, no uno agrupado.
        for (const item of message.results) {
          result.push({ role: 'tool', tool_call_id: item.id, content: item.content })
        }
        break
    }
  }

  return result
}

/**
 * Con OPENAI_BASE_URL este proveedor habla con cualquier servidor compatible
 * con la API de OpenAI: un modelo local (Ollama, LM Studio, vLLM) o un servicio
 * en la nube con capa gratuita (Groq, Gemini, OpenRouter, Mistral…). La clave
 * puede ser cualquier texto si el servidor no la pide.
 */
export function createOpenAiProvider(apiKey: string): LlmProvider {
  const baseURL = process.env.OPENAI_BASE_URL || undefined
  const client = new OpenAI({ apiKey: apiKey || 'sin-clave', baseURL })
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL
  // Los servidores compatibles entienden `max_tokens`; `max_completion_tokens`
  // es más nuevo y no todos lo aceptan.
  const limitParam = baseURL ? 'max_tokens' : 'max_completion_tokens'
  const host = baseURL ? new URL(baseURL).host : 'api.openai.com'

  return {
    id: 'openai',
    model,

    async complete(request: LlmRequest): Promise<LlmCompletion> {
      const system = request.context ? `${request.system}\n\n${request.context}` : request.system
      const response = await client.chat.completions.create({
        model,
        [limitParam]: request.maxTokens,
        messages: toMessages(system, request.messages),
        ...(request.tools?.length
          ? {
              tools: request.tools.map((tool) => ({
                type: 'function' as const,
                function: {
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.parameters,
                },
              })),
            }
          : {}),
      })

      const choice = response.choices[0]?.message
      const finishReason = response.choices[0]?.finish_reason

      const toolCalls = (choice?.tool_calls ?? []).flatMap((call) => {
        if (call.type !== 'function') return []
        let input: Record<string, unknown> = {}
        try {
          // Los argumentos vienen como string JSON y el modelo puede mandar
          // algo mal formado: si pasa, se sigue con input vacío y la
          // herramienta responde qué datos faltan en vez de romper el chat.
          input = JSON.parse(call.function.arguments || '{}')
        } catch {
          input = {}
        }
        return [{ id: call.id, name: call.function.name, input }]
      })

      return {
        text: (choice?.content ?? '').trim(),
        toolCalls,
        incomplete: finishReason === 'length' || finishReason === 'content_filter',
      }
    },

    describeError(error: unknown): string {
      const status = (error as { status?: number })?.status
      const raw = error instanceof Error ? error.message : String(error)

      if (/not in allowlist|ENOTFOUND|ECONNREFUSED|fetch failed/i.test(raw)) {
        return `El servidor no puede conectarse a ${host}. Revisa que esté encendido y accesible desde el hosting.`
      }
      if (status === 401) {
        return 'La API key de OpenAI es inválida. Revisa OPENAI_API_KEY.'
      }
      if (status === 429 || /quota/i.test(raw)) {
        return 'OpenAI rechazó la consulta por falta de saldo o límite de uso. Revisa el billing en platform.openai.com.'
      }
      if (status === 404 || /does not exist|model/i.test(raw)) {
        return `El modelo ${model} no está disponible para esta cuenta. Revisa OPENAI_MODEL.`
      }
      if (status && status >= 500) {
        return 'OpenAI tuvo un error temporal. Reintenta en un momento.'
      }
      return raw
    },
  }
}
