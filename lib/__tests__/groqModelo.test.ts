import { describe, expect, it, vi } from 'vitest'
import { resolveModel } from '../llm/openai'

/**
 * Groq retiró llama-3.3-70b-versatile y el agente dejó de responder en
 * producción con "el modelo no está disponible". El reemplazo tiene que
 * aplicar solo ahí: cambiarle el modelo a otro proveedor sería peor que el
 * error original.
 */
describe('resolveModel', () => {
  it('cambia un modelo retirado de Groq por su sucesor', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveModel('llama-3.3-70b-versatile', 'api.groq.com')).toBe('openai/gpt-oss-120b')
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('no toca un modelo vigente de Groq', () => {
    expect(resolveModel('openai/gpt-oss-120b', 'api.groq.com')).toBe('openai/gpt-oss-120b')
  })

  it('no toca el mismo nombre en otro servidor', () => {
    expect(resolveModel('llama-3.3-70b-versatile', 'localhost:11434')).toBe('llama-3.3-70b-versatile')
    expect(resolveModel('llama-3.3-70b-versatile', 'api.openai.com')).toBe('llama-3.3-70b-versatile')
  })
})
