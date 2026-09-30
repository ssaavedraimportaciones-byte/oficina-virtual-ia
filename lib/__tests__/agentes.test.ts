import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'crypto'
import * as llm from '../llm'
import type { LlmCompletion, LlmProvider, LlmRequest } from '../llm'
import * as store from '../store'
import * as notifications from '../notifications'
import * as whatsapp from '../whatsapp'
import { getAvailableSlots, isSlotFree } from '../agenda'
import { FALLBACK_REPLY, MAX_HISTORY_MESSAGES, generateAgentReply, toLlmMessages } from '../agentEngine'
import { handleIncomingMessage } from '../agentPipeline'
import { runAgentTool } from '../agentTools'
import { newConversationEmail } from '../email'
import { sendHumanReply } from '../humanReply'
import { businessNow } from '../timezone'
import { DEFAULT_WEEK_HOURS, type Business, type Message } from '../types'

/**
 * Proveedor falso: devuelve las respuestas en orden y guarda cada pedido,
 * para probar el motor sin llamar a la API de verdad.
 */
function fakeProvider(responses: LlmCompletion[]) {
  const requests: LlmRequest[] = []
  const provider: LlmProvider = {
    id: 'anthropic',
    model: 'fake',
    async complete(request) {
      // Copia: el motor sigue agregando mensajes al mismo array después.
      requests.push({ ...request, messages: [...request.messages] })
      return responses.shift() ?? { text: 'respuesta por defecto', toolCalls: [] }
    },
    describeError: () => 'error',
  }
  vi.spyOn(llm, 'getProvider').mockReturnValue(provider)
  return requests
}

function msg(sender: Message['sender'], text: string): Message {
  return { id: randomUUID(), sender, text, timestamp: new Date().toISOString() }
}

async function newBusiness(): Promise<Business> {
  return store.createBusiness(
    {
      agentName: 'Bella', businessName: 'Uñas Bella', industry: 'Manicura',
      description: 'x', goals: 'y', tone: 'cercano', channels: ['whatsapp'],
      configuredAt: new Date().toISOString(),
    },
    'manicura',
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('historial que ve el agente', () => {
  it('incluye lo que escribió el equipo, marcado, y junta mensajes seguidos', () => {
    const out = toLlmMessages([
      msg('contact', 'hola'),
      msg('contact', 'cuánto sale el semi?'),
      msg('agent', 'Sale $8000'),
      msg('human', 'Te hago 10% si venís hoy'),
      msg('contact', 'dale'),
    ])

    expect(out).toEqual([
      { role: 'user', text: 'hola\ncuánto sale el semi?' },
      { role: 'assistant', text: 'Sale $8000\n[Equipo] Te hago 10% si venís hoy' },
      { role: 'user', text: 'dale' },
    ])
  })

  it('recorta conversaciones largas y siempre arranca por el cliente', () => {
    const history: Message[] = []
    for (let i = 0; i < MAX_HISTORY_MESSAGES + 11; i += 1) {
      history.push(msg(i % 2 === 0 ? 'contact' : 'agent', `m${i}`))
    }
    const out = toLlmMessages(history)
    expect(out[0].role).toBe('user')
    expect(out.length).toBeLessThanOrEqual(MAX_HISTORY_MESSAGES)
    expect(out[out.length - 1]).toEqual({ role: 'user', text: `m${MAX_HISTORY_MESSAGES + 10}` })
  })
})

describe('motor del agente', () => {
  it('pasa la ficha del contacto y la fecha en el contexto, no en el prompt cacheado', async () => {
    const requests = fakeProvider([{ text: 'hola!', toolCalls: [] }])
    const business = await newBusiness()

    await generateAgentReply(business.config, [], [msg('contact', 'hola')], {
      contactNotes: '- Busca uñas para un casamiento',
    })

    expect(requests[0].context).toContain('Busca uñas para un casamiento')
    expect(requests[0].context).toContain(businessNow().date)
    expect(requests[0].system).not.toContain('casamiento')
    expect(requests[0].system).not.toContain(businessNow().date)
  })

  it('no le manda al cliente una respuesta cortada o vacía', async () => {
    fakeProvider([{ text: 'Hola, te cuen', toolCalls: [], incomplete: true }])
    const business = await newBusiness()
    const reply = await generateAgentReply(business.config, [], [msg('contact', 'hola')])
    expect(reply).toBe(FALLBACK_REPLY)
  })

  it('devuelve la respuesta cruda del modelo en la siguiente vuelta del loop', async () => {
    const raw = [{ type: 'thinking', thinking: '', signature: 'x' }]
    const requests = fakeProvider([
      { text: '', toolCalls: [{ id: 'c1', name: 'consultar_catalogo', input: {} }], raw },
      { text: 'Tenemos esmaltes', toolCalls: [] },
    ])
    const business = await newBusiness()
    await store.addProduct({ businessId: business.id, name: 'Esmalte', price: 1000, stock: 3 })
    const conversation = await store.createConversation({
      businessId: business.id, channel: 'simulador', contactName: 'Ana', contactHandle: randomUUID(),
    })

    const reply = await generateAgentReply(business.config, [], [msg('contact', 'qué tenés?')], {
      products: await store.listProducts(business.id),
      toolContext: { business, conversation },
    })

    expect(reply).toBe('Tenemos esmaltes')
    const second = requests[1].messages
    expect(second[1]).toMatchObject({ role: 'assistant_tools', raw })
    expect(second[2]).toMatchObject({ role: 'tool_results' })
  })

  it('ofrece derivar a una persona aunque el negocio no tenga agenda ni catálogo', async () => {
    const requests = fakeProvider([{ text: 'hola', toolCalls: [] }])
    const business = await newBusiness()
    const conversation = await store.createConversation({
      businessId: business.id, channel: 'simulador', contactName: 'Ana', contactHandle: randomUUID(),
    })

    await generateAgentReply(business.config, [], [msg('contact', 'hola')], {
      toolContext: { business, conversation },
    })

    expect(requests[0].tools?.map((t) => t.name)).toEqual(['derivar_a_humano'])
  })
})

describe('derivar a una persona', () => {
  it('pausa al agente en la conversación y avisa al equipo', async () => {
    const notify = vi.spyOn(notifications, 'notifyHandoff').mockResolvedValue()
    const business = await newBusiness()
    const conversation = await store.createConversation({
      businessId: business.id, channel: 'whatsapp', contactName: 'Ana', contactHandle: randomUUID(),
    })

    const out = await runAgentTool({ business, conversation }, 'derivar_a_humano', {
      motivo: 'Reclamo: el pedido no llegó',
    })

    expect(out).toContain('derivada')
    const updated = await store.getConversation(conversation.id)
    expect(updated?.agentPaused).toBe(true)
    expect(updated?.handoffReason).toBe('Reclamo: el pedido no llegó')
    expect(notify).toHaveBeenCalledOnce()
  })

  it('si falla el mail, igual deriva', async () => {
    vi.spyOn(notifications, 'notifyHandoff').mockRejectedValue(new Error('smtp caído'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const business = await newBusiness()
    const conversation = await store.createConversation({
      businessId: business.id, channel: 'whatsapp', contactName: 'Ana', contactHandle: randomUUID(),
    })

    await runAgentTool({ business, conversation }, 'derivar_a_humano', { motivo: 'x' })
    expect((await store.getConversation(conversation.id))?.agentPaused).toBe(true)
  })
})

describe('respuesta de una persona desde el panel', () => {
  it('sale por WhatsApp de verdad y pausa al agente', async () => {
    const send = vi.spyOn(whatsapp, 'sendWhatsAppMessage').mockResolvedValue()
    const business = await newBusiness()
    const conversation = await store.createConversation({
      businessId: business.id, channel: 'whatsapp', contactName: 'Ana', contactHandle: '5491100000009',
    })

    const updated = await sendHumanReply(business, conversation, 'Hola Ana, soy Caro del local')

    expect(send).toHaveBeenCalledWith('5491100000009', 'Hola Ana, soy Caro del local', expect.anything())
    expect(updated.agentPaused).toBe(true)
    expect(updated.messages.at(-1)).toMatchObject({ sender: 'human', text: 'Hola Ana, soy Caro del local' })
  })

  it('si WhatsApp rechaza el envío, no queda guardado como enviado', async () => {
    vi.spyOn(whatsapp, 'sendWhatsAppMessage').mockRejectedValue(new Error('WhatsApp API respondió 400'))
    const business = await newBusiness()
    const conversation = await store.createConversation({
      businessId: business.id, channel: 'whatsapp', contactName: 'Ana', contactHandle: randomUUID(),
    })

    await expect(sendHumanReply(business, conversation, 'hola')).rejects.toThrow('400')
    const after = await store.getConversation(conversation.id)
    expect(after?.messages).toHaveLength(0)
    expect(after?.agentPaused).toBe(false)
  })
})

describe('pipeline de mensajes entrantes', () => {
  let business: Business

  beforeEach(async () => {
    business = await newBusiness()
    vi.spyOn(notifications, 'notifyNewConversation').mockResolvedValue()
  })

  function incoming(text: string, contactHandle: string, externalId?: string) {
    return { business, channel: 'whatsapp' as const, contactHandle, contactName: 'Ana', text, externalId }
  }

  it('un reintento de Meta con el mismo ID no genera una segunda respuesta', async () => {
    fakeProvider([{ text: 'hola!', toolCalls: [] }, { text: 'otra vez', toolCalls: [] }])
    const send = vi.fn().mockResolvedValue(undefined)
    const handle = randomUUID()
    const wamid = `wamid.${randomUUID()}`

    const first = await handleIncomingMessage(incoming('hola', handle, wamid), { send, debounceMs: 0 })
    const retry = await handleIncomingMessage(incoming('hola', handle, wamid), { send, debounceMs: 0 })

    expect(first.status).toBe('replied')
    expect(retry.status).toBe('duplicate')
    expect(send).toHaveBeenCalledOnce()
    const conversation = await store.findConversationByContact(business.id, 'whatsapp', handle)
    expect(conversation?.messages.map((m) => m.sender)).toEqual(['contact', 'agent'])
  })

  it('con una persona a cargo, guarda el mensaje pero el agente no contesta', async () => {
    fakeProvider([])
    const send = vi.fn()
    const handle = randomUUID()
    const { conversation } = await store.findOrCreateConversation({
      businessId: business.id, channel: 'whatsapp', contactName: 'Ana', contactHandle: handle,
    })
    await store.setAgentPaused(conversation.id, true, 'Reclamo')

    const result = await handleIncomingMessage(incoming('sigo esperando', handle), { send, debounceMs: 0 })

    expect(result.status).toBe('paused')
    expect(send).not.toHaveBeenCalled()
    const saved = await store.getConversation(conversation.id)
    expect(saved?.messages.map((m) => m.text)).toEqual(['sigo esperando'])
  })

  it('a una ráfaga de mensajes le contesta una sola vez, con todo el contexto', async () => {
    const requests = fakeProvider([{ text: 'Sale $8000, ¿querés turno?', toolCalls: [] }])
    const send = vi.fn().mockResolvedValue(undefined)
    const handle = randomUUID()

    // Sin ficha: acá solo interesa cuántas respuestas genera.
    const deps = { send, debounceMs: 300, defer: () => {} }
    const results = await Promise.all([
      handleIncomingMessage(incoming('hola', handle, randomUUID()), deps),
      new Promise((r) => setTimeout(r, 50)).then(() =>
        handleIncomingMessage(incoming('cuánto sale el semi?', handle, randomUUID()), deps),
      ),
    ])

    expect(results.map((r) => r.status).sort()).toEqual(['replied', 'superseded'])
    expect(send).toHaveBeenCalledOnce()
    expect(requests).toHaveLength(1)
    expect(requests[0].messages[0]).toEqual({ role: 'user', text: 'hola\ncuánto sale el semi?' })
  })

  it('si el envío falla, la respuesta no queda como enviada', async () => {
    fakeProvider([{ text: 'hola!', toolCalls: [] }])
    const handle = randomUUID()
    const send = vi.fn().mockRejectedValue(new Error('WhatsApp caído'))

    await expect(
      handleIncomingMessage(incoming('hola', handle), { send, debounceMs: 0 }),
    ).rejects.toThrow('WhatsApp caído')

    const conversation = await store.findConversationByContact(business.id, 'whatsapp', handle)
    expect(conversation?.messages.map((m) => m.sender)).toEqual(['contact'])
  })

  it('la ficha y el aviso de conversación nueva corren después de contestar', async () => {
    fakeProvider([{ text: 'hola!', toolCalls: [] }, { text: '- Quiere turno', toolCalls: [] }])
    const order: string[] = []
    const send = vi.fn(async () => { order.push('send') })
    const deferred: Array<() => Promise<void>> = []

    await handleIncomingMessage(incoming('hola', randomUUID()), {
      send,
      debounceMs: 0,
      defer: (task) => { deferred.push(task) },
    })

    expect(order).toEqual(['send'])
    expect(notifications.notifyNewConversation).not.toHaveBeenCalled()
    await Promise.all(deferred.map((task) => task()))
    expect(notifications.notifyNewConversation).toHaveBeenCalledOnce()
  })
})

describe('conversaciones concurrentes', () => {
  it('dos webhooks simultáneos del mismo contacto nuevo terminan en la misma conversación', async () => {
    const business = await newBusiness()
    const input = { businessId: business.id, channel: 'whatsapp' as const, contactName: 'Ana', contactHandle: randomUUID() }
    const [a, b] = await Promise.all([store.findOrCreateConversation(input), store.findOrCreateConversation(input)])
    expect(a.conversation.id).toBe(b.conversation.id)
    expect([a.created, b.created].filter(Boolean)).toHaveLength(1)
  })
})

describe('horarios que ya pasaron', () => {
  const HOURS = DEFAULT_WEEK_HOURS
  // 2026-08-10 es lunes.
  const now = { date: '2026-08-10', time: '11:15' }

  it('no se ofrecen turnos de hoy que ya empezaron', () => {
    const slots = getAvailableSlots(HOURS, [], 60, '2026-08-10', '2026-08-10', 40, now)
    expect(slots[0]).toEqual({ date: '2026-08-10', time: '11:30' })
  })

  it('no se puede reservar en el pasado', () => {
    expect(isSlotFree(HOURS, [], '2026-08-10T10:00', 60, now)).toEqual({ ok: false, reason: 'Ese horario ya pasó.' })
    expect(isSlotFree(HOURS, [], '2026-08-10T12:00', 60, now).ok).toBe(true)
  })

  it('la fecha de "hoy" sale de la zona horaria del negocio, no de UTC', () => {
    const original = process.env.BUSINESS_TIMEZONE
    process.env.BUSINESS_TIMEZONE = 'America/Santiago'
    // 01:30 UTC del 11 de agosto = todavía 10 de agosto a la noche en Chile.
    expect(businessNow(new Date('2026-08-11T01:30:00Z'))).toEqual({ date: '2026-08-10', time: '21:30' })
    process.env.BUSINESS_TIMEZONE = 'Zona/Inventada'
    expect(businessNow(new Date('2026-08-11T01:30:00Z')).date).toBe('2026-08-10')
    process.env.BUSINESS_TIMEZONE = original
  })

  it('agendar_turno rechaza fechas u horas con formato inválido', async () => {
    const business = await newBusiness()
    await store.addService({ businessId: business.id, name: 'Semi', durationMinutes: 60, price: '$1' })
    const conversation = await store.createConversation({
      businessId: business.id, channel: 'whatsapp', contactName: 'Ana', contactHandle: randomUUID(),
    })

    const out = await runAgentTool({ business, conversation }, 'agendar_turno', {
      servicio: 'Semi', fecha: '2099-01-05', hora: '3pm', nombre_cliente: 'Ana',
    })

    expect(out).toContain('HH:mm')
    expect(await store.listAppointments(business.id)).toHaveLength(0)
  })
})

describe('mails al dueño', () => {
  it('escapa el nombre que pone el contacto', () => {
    const { html } = newConversationEmail('Mi negocio', '<a href="https://phish.example">Ana</a>', 'https://app/x')
    expect(html).not.toContain('<a href="https://phish.example">')
    expect(html).toContain('&lt;a href=')
  })
})

describe('multi-empresa', () => {
  it('un mensaje a un número que no es de ninguna empresa no se le asigna a nadie', async () => {
    const original = process.env.SINGLE_BUSINESS_MODE
    delete process.env.SINGLE_BUSINESS_MODE
    await newBusiness()
    expect(await store.findBusinessByChannelId('whatsapp', `numero-${randomUUID()}`)).toBeNull()
    process.env.SINGLE_BUSINESS_MODE = original
  })
})

describe('conectar canales en multi-empresa', () => {
  it('un número ya conectado a otra empresa se detecta y la base no deja duplicarlo', async () => {
    const a = await newBusiness()
    const b = await newBusiness()
    const phoneNumberId = `num-${randomUUID()}`
    const creds = { whatsappPhoneNumberId: phoneNumberId, whatsappAccessToken: 't', instagramPageId: null, instagramAccessToken: null }
    await store.updateBusinessCredentials(a.id, creds)

    expect(await store.findChannelOwner('whatsapp', phoneNumberId)).toBe(a.id)
    await expect(store.updateBusinessCredentials(b.id, creds)).rejects.toThrow()
  })

  it('suscribe la app al WABA dueño del número (propio o compartido por el cliente)', async () => {
    const { subscribeWhatsAppWebhooks } = await import('../metaConnect')
    const calls: Array<{ url: string; method: string }> = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' })
      if ((init?.method ?? 'GET') === 'GET') {
        return new Response(JSON.stringify({
          data: [{ client_whatsapp_business_accounts: { data: [{ id: 'waba-1', phone_numbers: { data: [{ id: 'phone-1' }] } }] } }],
        }))
      }
      return new Response(JSON.stringify({ success: true }))
    }) as any)

    expect(await subscribeWhatsAppWebhooks('phone-1', 'tok')).toEqual({ subscribed: true })
    expect(calls.at(-1)).toEqual({ url: expect.stringContaining('/waba-1/subscribed_apps'), method: 'POST' })

    const missing = await subscribeWhatsAppWebhooks('phone-que-no-esta', 'tok')
    expect(missing.subscribed).toBe(false)
  })
})

describe('disponibilidad por franja horaria', () => {
  it('hora_desde deja ver los horarios de la tarde (antes solo aparecían los primeros 12, de mañana)', async () => {
    const business = await newBusiness()
    await store.addService({ businessId: business.id, name: 'Semi', durationMinutes: 60, price: '$1' })
    const conversation = await store.createConversation({
      businessId: business.id, channel: 'whatsapp', contactName: 'Ana', contactHandle: randomUUID(),
    })
    const ctx = { business, conversation }
    const monday = '2099-01-05' // lunes

    const sinFiltro = await runAgentTool(ctx, 'consultar_disponibilidad', { servicio: 'Semi', desde: monday })
    expect(sinFiltro).toContain('09:00')
    expect(sinFiltro).not.toContain('16:00')

    const tarde = await runAgentTool(ctx, 'consultar_disponibilidad', { servicio: 'Semi', desde: monday, hora_desde: '14:00' })
    expect(tarde).toContain('14:00')
    expect(tarde).toContain('16:30')
    expect(tarde).not.toContain('09:00')
    expect(tarde).not.toContain('13:30')
  })
})
