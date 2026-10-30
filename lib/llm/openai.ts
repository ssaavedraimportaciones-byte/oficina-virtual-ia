import OpenAI from 'openai'
import { env } from './env'
import type { LlmCompletion, LlmMessage, LlmProvider, LlmRequest } from './types'

const DEFAULT_MODEL = 'gpt-4o'

/**
 * Modelos que Groq ya retiró de su capa gratuita y su sucesor recomendado
 * (https://console.groq.com/docs/deprecations). Una clave cargada cuando el
 * modelo aún existía sigue apuntando al nombre viejo, y el agente deja de
 * responder con "el modelo no está disponible" sin que nadie haya tocado nada.
 * Se reemplaza solo en Groq y solo con la correspondencia que Groq publica.
 */
const GROQ_FALLBACK_MODEL = 'openai/gpt-oss-20b'

const RETIRED_GROQ_MODELS: Record<string, string> = {
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
}

/**
 * Los modelos gpt-oss de Groq razonan antes de contestar y por defecto lo
 * hacen a nivel medio. Un pedido en el chat encadena varias llamadas (armar el
 * pedido, anotarlo, confirmarlo) y el cliente llegó a esperar cerca de un
 * minuto. Para conversar con clientes alcanza el nivel bajo y responde mucho
 * más rápido. Solo se manda donde Groq lo acepta: otro servidor puede
 * rechazar un parámetro que no conoce.
 */
export function modelOptions(host: string, model: string): { reasoning_effort?: 'low' } {
  return host === 'api.groq.com' && model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}
}

export function resolveModel(requested: string, host: string): string {
  const successor = host === 'api.groq.com' ? RETIRED_GROQ_MODELS[requested] : undefined
  if (!successor) return requested
  console.warn(`[llm] Groq retiró "${requested}": se usa "${successor}". Actualiza OPENAI_MODEL.`)
  return successor
}

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
  const baseURL = env('OPENAI_BASE_URL')
  const client = new OpenAI({ apiKey: apiKey || 'sin-clave', baseURL, timeout: 15_000, maxRetries: 1 })
  const host = baseURL ? new URL(baseURL).host : 'api.openai.com'
  const model = resolveModel(env('OPENAI_MODEL') || DEFAULT_MODEL, host)
  // Los servidores compatibles entienden `max_tokens`; `max_completion_tokens`
  // es más nuevo y no todos lo aceptan.
  const limitParam = baseURL ? 'max_tokens' : 'max_completion_tokens'

  return {
    id: 'openai',
    model,

    async complete(request: LlmRequest): Promise<LlmCompletion> {
      const system = request.context ? `${request.system}\n\n${request.context}` : request.system
      const create = (useModel: string) => client.chat.completions.create({
        model: useModel,
        ...modelOptions(host, useModel),
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

      // Si el modelo principal se queda sin cupo de Groq (429) o no contesta a
      // tiempo, se prueba una vez con el modelo chico, que tiene su propio cupo
      // y responde más rápido, en vez de dejar esperando al cliente.
      let response
      try {
        response = await create(model)
      } catch (error) {
        const fallback = host === 'api.groq.com' ? GROQ_FALLBACK_MODEL : null
        const status = (error as { status?: number }).status
        const retryable = status === 429 || status === undefined || status >= 500
        if (!fallback || fallback === model || !retryable) throw error
        console.error('[llm] falló el modelo principal, se usa el de respaldo:', status ?? error)
        response = await create(fallback)
      }

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
