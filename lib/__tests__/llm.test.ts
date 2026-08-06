import { afterEach, describe, expect, it, vi } from 'vitest'
import { providerStatus, resetProvider } from '../llm'

const ORIGINAL = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL }
  resetProvider()
  vi.restoreAllMocks()
})

function clearKeys() {
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.OPENAI_API_KEY
  delete process.env.LLM_PROVIDER
  delete process.env.ANTHROPIC_MODEL
  delete process.env.OPENAI_MODEL
  resetProvider()
}

describe('selección de proveedor', () => {
  it('sin claves, no hay proveedor configurado', () => {
    clearKeys()
    expect(providerStatus().configured).toBe(false)
  })

  it('usa OpenAI si es la única clave cargada', () => {
    clearKeys()
    process.env.OPENAI_API_KEY = 'sk-test'
    expect(providerStatus().id).toBe('openai')
  })

  it('usa Anthropic si es la única clave cargada', () => {
    clearKeys()
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    expect(providerStatus().id).toBe('anthropic')
  })

  it('con las dos claves gana Anthropic salvo que se aclare', () => {
    clearKeys()
    process.env.ANTHROPIC_API_KEY = 'a'
    process.env.OPENAI_API_KEY = 'b'
    expect(providerStatus().id).toBe('anthropic')

    process.env.LLM_PROVIDER = 'openai'
    expect(providerStatus().id).toBe('openai')
  })

  it('respeta el modelo configurado', () => {
    clearKeys()
    process.env.OPENAI_API_KEY = 'b'
    process.env.LLM_PROVIDER = 'openai'
    process.env.OPENAI_MODEL = 'gpt-4o-mini'
    expect(providerStatus().model).toBe('gpt-4o-mini')
  })
})

describe('traducción de herramientas por proveedor', () => {
  const tool = {
    name: 'consultar_catalogo',
    description: 'Devuelve productos',
    parameters: { type: 'object', properties: { busqueda: { type: 'string' } } },
  }

  it('OpenAI recibe las herramientas como function y devuelve tool calls normalizadas', async () => {
    clearKeys()
    process.env.OPENAI_API_KEY = 'sk-test'
    const { createOpenAiProvider } = await import('../llm/openai')
    const provider = createOpenAiProvider('sk-test')

    let captured: any
    const OpenAI = (await import('openai')).default
    vi.spyOn(OpenAI.Chat.Completions.prototype, 'create').mockImplementation((async (body: any) => {
      captured = body
      return {
        choices: [{
          message: {
            content: 'texto',
            tool_calls: [{ id: 'c1', type: 'function', function: { name: 'consultar_catalogo', arguments: '{"busqueda":"torta"}' } }],
          },
        }],
      }
    }) as any)

    const out = await provider.complete({
      system: 'sos un agente', maxTokens: 100, tools: [tool],
      messages: [{ role: 'user', text: 'hola' }],
    })

    expect(captured.tools[0].type).toBe('function')
    expect(captured.tools[0].function.name).toBe('consultar_catalogo')
    expect(captured.messages[0]).toEqual({ role: 'system', content: 'sos un agente' })
    expect(out.text).toBe('texto')
    expect(out.toolCalls).toEqual([{ id: 'c1', name: 'consultar_catalogo', input: { busqueda: 'torta' } }])
  })

  it('OpenAI: argumentos mal formados no rompen, devuelven input vacío', async () => {
    const { createOpenAiProvider } = await import('../llm/openai')
    const provider = createOpenAiProvider('sk-test')
    const OpenAI = (await import('openai')).default
    vi.spyOn(OpenAI.Chat.Completions.prototype, 'create').mockResolvedValue({
      choices: [{ message: { content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'x', arguments: '{roto' } }] } }],
    } as any)

    const out = await provider.complete({ system: 's', maxTokens: 10, messages: [] })
    expect(out.toolCalls[0].input).toEqual({})
  })

  it('OpenAI manda un mensaje role:tool por cada resultado', async () => {
    const { createOpenAiProvider } = await import('../llm/openai')
    const provider = createOpenAiProvider('sk-test')
    const OpenAI = (await import('openai')).default
    let captured: any
    vi.spyOn(OpenAI.Chat.Completions.prototype, 'create').mockImplementation((async (body: any) => {
      captured = body
      return { choices: [{ message: { content: 'ok' } }] }
    }) as any)

    await provider.complete({
      system: 's', maxTokens: 10,
      messages: [
        { role: 'user', text: 'hola' },
        { role: 'assistant_tools', text: '', calls: [{ id: 'c1', name: 'x', input: {} }, { id: 'c2', name: 'y', input: {} }] },
        { role: 'tool_results', results: [{ id: 'c1', content: 'r1' }, { id: 'c2', content: 'r2' }] },
      ],
    })

    const toolMsgs = captured.messages.filter((m: any) => m.role === 'tool')
    expect(toolMsgs).toHaveLength(2)
    expect(toolMsgs[0]).toEqual({ role: 'tool', tool_call_id: 'c1', content: 'r1' })
  })

  it('Anthropic recibe las herramientas con input_schema', async () => {
    const { createAnthropicProvider } = await import('../llm/anthropic')
    const provider = createAnthropicProvider('sk-ant-test')
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    let captured: any
    vi.spyOn(Anthropic.Messages.prototype, 'create').mockImplementation((async (body: any) => {
      captured = body
      return { content: [{ type: 'text', text: 'hola' }] }
    }) as any)

    const out = await provider.complete({
      system: 's', maxTokens: 10, tools: [tool], messages: [{ role: 'user', text: 'hola' }],
    })

    expect(captured.tools[0].input_schema).toEqual(tool.parameters)
    expect(captured.system).toBe('s')
    expect(out.text).toBe('hola')
  })
})

describe('mensajes de error', () => {
  it('OpenAI traduce 401 y falta de saldo', async () => {
    const { createOpenAiProvider } = await import('../llm/openai')
    const p = createOpenAiProvider('x')
    expect(p.describeError(Object.assign(new Error('bad'), { status: 401 }))).toContain('OPENAI_API_KEY')
    expect(p.describeError(Object.assign(new Error('exceeded quota'), { status: 429 }))).toContain('billing')
  })

  it('Anthropic traduce falta de saldo', async () => {
    const { createAnthropicProvider } = await import('../llm/anthropic')
    const p = createAnthropicProvider('x')
    expect(p.describeError(new Error('credit balance is too low'))).toContain('no tiene saldo')
  })
})
