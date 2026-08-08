import { createAnthropicProvider } from './anthropic'
import { createOpenAiProvider } from './openai'
import type { LlmProvider } from './types'

export * from './types'

let cached: LlmProvider | null = null

/** Qué proveedor está configurado, sin construirlo. Sirve para el panel. */
export function providerStatus(): {
  configured: boolean
  id: 'anthropic' | 'openai' | null
  model: string | null
} {
  const preferred = process.env.LLM_PROVIDER
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY)
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY)

  if (preferred === 'openai' && hasOpenAi) {
    return { configured: true, id: 'openai', model: process.env.OPENAI_MODEL || 'gpt-4o' }
  }
  if (preferred === 'anthropic' && hasAnthropic) {
    return {
      configured: true,
      id: 'anthropic',
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
    }
  }
  if (hasAnthropic) {
    return {
      configured: true,
      id: 'anthropic',
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
    }
  }
  if (hasOpenAi) {
    return { configured: true, id: 'openai', model: process.env.OPENAI_MODEL || 'gpt-4o' }
  }
  return { configured: false, id: null, model: null }
}

/**
 * Elige el proveedor según LLM_PROVIDER, o el que tenga clave cargada. Si están
 * las dos claves y no se aclara cuál usar, gana Anthropic.
 */
export function getProvider(): LlmProvider {
  if (cached) return cached

  const status = providerStatus()
  if (!status.configured) {
    throw new Error(
      'No hay ningún proveedor de IA configurado. Cargá ANTHROPIC_API_KEY o OPENAI_API_KEY para que el agente pueda responder.',
    )
  }

  cached =
    status.id === 'openai'
      ? createOpenAiProvider(process.env.OPENAI_API_KEY as string)
      : createAnthropicProvider(process.env.ANTHROPIC_API_KEY as string)

  return cached
}

/** Solo para tests: fuerza releer las variables de entorno. */
export function resetProvider(): void {
  cached = null
}
