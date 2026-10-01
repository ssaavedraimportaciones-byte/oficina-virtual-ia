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
      system: 'eres un agente', maxTokens: 100, tools: [tool],
      messages: [{ role: 'user', text: 'hola' }],
    })

    expect(captured.tools[0].type).toBe('function')
    expect(captured.tools[0].function.name).toBe('consultar_catalogo')
    expect(captured.messages[0]).toEqual({ role: 'system', content: 'eres un agente' })
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
    expect(captured.system).toEqual([{ type: 'text', text: 's', cache_control: { type: 'ephemeral' } }])
    expect(out.text).toBe('hola')
  })

  it('Anthropic cachea la parte estable del prompt y deja el contexto de la conversación afuera', async () => {
    const { createAnthropicProvider } = await import('../llm/anthropic')
    const provider = createAnthropicProvider('sk-ant-test')
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    let captured: any
    vi.spyOn(Anthropic.Messages.prototype, 'create').mockImplementation((async (body: any) => {
      captured = body
      return { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' }
    }) as any)

    await provider.complete({
      system: 'estable', context: 'hoy es lunes', maxTokens: 10,
      messages: [{ role: 'user', text: 'hola' }],
    })

    expect(captured.system).toEqual([
      { type: 'text', text: 'estable', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'hoy es lunes' },
    ])
  })

  it('Anthropic devuelve intacto el turno con thinking en el loop de herramientas', async () => {
    const { createAnthropicProvider } = await import('../llm/anthropic')
    const provider = createAnthropicProvider('sk-ant-test')
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const raw = [
      { type: 'thinking', thinking: '', signature: 'firma' },
      { type: 'tool_use', id: 't1', name: 'consultar_catalogo', input: {} },
    ]
    let captured: any
    vi.spyOn(Anthropic.Messages.prototype, 'create').mockImplementation((async (body: any) => {
      captured = body
      return { content: [{ type: 'text', text: 'listo' }], stop_reason: 'end_turn' }
    }) as any)

    await provider.complete({
      system: 's', maxTokens: 10,
      messages: [
        { role: 'user', text: 'qué tienes' },
        { role: 'assistant_tools', text: '', calls: [{ id: 't1', name: 'consultar_catalogo', input: {} }], raw },
        { role: 'tool_results', results: [{ id: 't1', content: 'tortas' }] },
      ],
    })

    expect(captured.messages[1]).toEqual({ role: 'assistant', content: raw })
  })

  it('Anthropic marca como incompleta una respuesta cortada por max_tokens o rechazada', async () => {
    const { createAnthropicProvider } = await import('../llm/anthropic')
    const provider = createAnthropicProvider('sk-ant-test')
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const spy = vi.spyOn(Anthropic.Messages.prototype, 'create')

    spy.mockResolvedValueOnce({ content: [{ type: 'text', text: 'Hola, te cuen' }], stop_reason: 'max_tokens' } as any)
    expect((await provider.complete({ system: 's', maxTokens: 10, messages: [] })).incomplete).toBe(true)

    spy.mockResolvedValueOnce({ content: [], stop_reason: 'refusal' } as any)
    expect((await provider.complete({ system: 's', maxTokens: 10, messages: [] })).incomplete).toBe(true)

    spy.mockResolvedValueOnce({ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' } as any)
    expect((await provider.complete({ system: 's', maxTokens: 10, messages: [] })).incomplete).toBe(false)
  })

  it('Anthropic manda effort solo a los modelos que lo soportan', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const { createAnthropicProvider, supportsEffort } = await import('../llm/anthropic')
    expect(supportsEffort('claude-sonnet-5')).toBe(true)
    expect(supportsEffort('claude-opus-4-8')).toBe(true)
    expect(supportsEffort('claude-haiku-4-5')).toBe(false)

    let captured: any
    vi.spyOn(Anthropic.Messages.prototype, 'create').mockImplementation((async (body: any) => {
      captured = body
      return { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' }
    }) as any)

    process.env.ANTHROPIC_MODEL = 'claude-sonnet-5'
    await createAnthropicProvider('x').complete({ system: 's', maxTokens: 10, effort: 'medium', messages: [] })
    expect(captured.output_config).toEqual({ effort: 'medium' })

    process.env.ANTHROPIC_MODEL = 'claude-haiku-4-5'
    await createAnthropicProvider('x').complete({ system: 's', maxTokens: 10, effort: 'medium', messages: [] })
    expect(captured.output_config).toBeUndefined()
  })

  it('OpenAI junta el contexto con el prompt y marca respuestas cortadas', async () => {
    const { createOpenAiProvider } = await import('../llm/openai')
    const OpenAI = (await import('openai')).default
    let captured: any
    vi.spyOn(OpenAI.Chat.Completions.prototype, 'create').mockImplementation((async (body: any) => {
      captured = body
      return { choices: [{ message: { content: 'Hola, te cuen' }, finish_reason: 'length' }] }
    }) as any)

    const out = await createOpenAiProvider('sk-test').complete({
      system: 'estable', context: 'hoy es lunes', maxTokens: 10, messages: [],
    })

    expect(captured.messages[0]).toEqual({ role: 'system', content: 'estable\n\nhoy es lunes' })
    expect(out.incomplete).toBe(true)
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
