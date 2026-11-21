import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { closedMessage, describeOrderWindow, orderWindowAt, type OrderWindowSettings } from '../orderWindow'
import { runAgentTool } from '../agentTools'
import { saveSalesSettings } from '../payments'
import { buildSystemPrompt } from '../agentPrompt'
import * as store from '../store'
import type { Business, Conversation, WeekHours } from '../types'

const FOOD_TRUCK: WeekHours = Array.from({ length: 7 }, () => ({ open: '19:00', close: '23:30' }))
const ON: OrderWindowSettings = { ordersOnlyInHours: true, preorderMinutes: 60, orderCutoffMinutes: 0 }
// 2026-11-23 es lunes
const at = (time: string, date = '2026-11-23') => ({ date, time })

describe('ventana de pedidos (regla pura)', () => {
  it('apagada: se toman pedidos a cualquier hora, como siempre', () => {
    expect(orderWindowAt(FOOD_TRUCK, { ...ON, ordersOnlyInHours: false }, at('03:00'))).toEqual({ state: 'open' })
  })

  it('antes de abrir, dentro del margen: pedido anticipado que se prepara al abrir', () => {
    expect(orderWindowAt(FOOD_TRUCK, ON, at('18:00'))).toEqual({ state: 'preorder', prepareAt: '19:00' })
    expect(orderWindowAt(FOOD_TRUCK, ON, at('18:59'))).toEqual({ state: 'preorder', prepareAt: '19:00' })
  })

  it('en horario: abierto', () => {
    expect(orderWindowAt(FOOD_TRUCK, ON, at('19:00'))).toEqual({ state: 'open' })
    expect(orderWindowAt(FOOD_TRUCK, ON, at('23:29'))).toEqual({ state: 'open' })
  })

  it('antes del margen o después de cerrar: cerrado, con la próxima hora', () => {
    expect(orderWindowAt(FOOD_TRUCK, ON, at('17:59'))).toEqual({ state: 'closed', next: { dayOffset: 0, time: '18:00' } })
    expect(orderWindowAt(FOOD_TRUCK, ON, at('23:30'))).toEqual({ state: 'closed', next: { dayOffset: 1, time: '18:00' } })
  })

  it('deja de recibir antes de cerrar si se configura', () => {
    const s = { ...ON, orderCutoffMinutes: 30 }
    expect(orderWindowAt(FOOD_TRUCK, s, at('22:59'))).toEqual({ state: 'open' })
    expect(orderWindowAt(FOOD_TRUCK, s, at('23:00')).state).toBe('closed')
  })

  it('entiende turnos que pasan la medianoche', () => {
    const late: WeekHours = Array.from({ length: 7 }, () => ({ open: '20:00', close: '02:00' }))
    expect(orderWindowAt(late, ON, at('01:30'))).toEqual({ state: 'open' })
    expect(orderWindowAt(late, ON, at('02:00')).state).toBe('closed')
  })

  it('salta los días cerrados al decir cuándo se puede pedir', () => {
    const weekdays: WeekHours = [null, { open: '19:00', close: '23:00' }, null, null, null, null, null]
    // lunes 23:30 → el próximo es el lunes siguiente
    const status = orderWindowAt(weekdays, ON, at('23:30'))
    expect(status).toEqual({ state: 'closed', next: { dayOffset: 7, time: '18:00' } })
    if (status.state === 'closed') expect(closedMessage(status, at('23:30'))).toContain('el lunes desde las 18:00')
  })

  it('el mensaje de cerrado le pide al agente no registrar y decir desde qué hora', () => {
    const status = orderWindowAt(FOOD_TRUCK, ON, at('10:00'))
    if (status.state !== 'closed') throw new Error('debía estar cerrado')
    const msg = closedMessage(status, at('10:00'))
    expect(msg).toContain('No lo registres')
    expect(msg).toContain('hoy desde las 18:00')
  })

  it('describe el horario para el prompt (vacío si está apagado)', () => {
    expect(describeOrderWindow(FOOD_TRUCK, { ...ON, ordersOnlyInHours: false })).toBe('')
    const text = describeOrderWindow(FOOD_TRUCK, ON)
    expect(text).toContain('- lunes: pedidos de 18:00 a 23:30 (los que llegan antes de las 19:00 se preparan desde esa hora)')
    expect(text.split('\n')).toHaveLength(7)
  })
})

describe('crear_pedido respeta la ventana', () => {
  let business: Business
  let conversation: Conversation

  beforeAll(async () => {
    business = await store.createBusiness(
      {
        agentName: 'Rodri', businessName: 'Carro de prueba', industry: 'Food truck',
        description: 'x', goals: 'y', tone: 'cercano', channels: ['whatsapp'],
        configuredAt: new Date().toISOString(),
      },
      'restaurante',
    )
    business = await store.updateBusinessHours(business.id, FOOD_TRUCK)
    await store.addProduct({ businessId: business.id, name: 'Completo italiano', price: 3500, stock: null })
    await saveSalesSettings(business.id, ON)
    conversation = await store.createConversation({
      businessId: business.id, channel: 'whatsapp', contactName: 'Ana', contactHandle: '56911111111',
    })
  })

  afterEach(() => vi.useRealTimers())

  // Noviembre en Chile: UTC-3
  const setLocal = (iso: string) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${iso}-03:00`))
  }

  it('a las 17:00 no registra y dice desde qué hora', async () => {
    setLocal('2026-11-23T17:00:00')
    const out = await runAgentTool({ business, conversation }, 'crear_pedido', {
      items: [{ producto: 'Completo italiano', cantidad: 1 }], nombre_cliente: 'Ana',
    })
    expect(out).toContain('No se pueden tomar pedidos ahora')
    expect(out).toContain('hoy desde las 18:00')
    expect(await store.listOrders(business.id)).toHaveLength(0)
  })

  it('a las 18:20 lo registra como anticipado y avisa a qué hora se prepara', async () => {
    setLocal('2026-11-23T18:20:00')
    const out = await runAgentTool({ business, conversation }, 'crear_pedido', {
      items: [{ producto: 'Completo italiano', cantidad: 2 }], nombre_cliente: 'Ana', nota: 'sin mayo',
    })
    expect(out).toContain('Pedido registrado')
    expect(out).toContain('se empieza a preparar a las 19:00')
    const [order] = await store.listOrders(business.id)
    expect(order.note).toBe('Pedido anticipado: se prepara desde las 19:00. sin mayo')
  })

  it('en horario lo registra normal', async () => {
    setLocal('2026-11-23T20:00:00')
    const out = await runAgentTool({ business, conversation }, 'crear_pedido', {
      items: [{ producto: 'Completo italiano', cantidad: 1 }], nombre_cliente: 'Ana',
    })
    expect(out).toContain('Pedido registrado')
    expect(out).not.toContain('todavía no abre')
  })
})

describe('prompt', () => {
  it('incluye el horario de pedidos solo cuando está activo', () => {
    const config = {
      agentName: 'Rodri', businessName: 'Carro', industry: 'Food truck', description: 'x', goals: 'y',
      tone: 'cercano' as const, channels: ['whatsapp' as const], configuredAt: '',
    }
    const products = [{ id: 'p', businessId: 'b', name: 'Completo', price: 3500, stock: null, active: true, imageVersion: null }]
    const off = buildSystemPrompt(config, [], [], products, [], [], { paymentsEnabled: false })
    expect(off).not.toContain('Horario para recibir pedidos')
    const on = buildSystemPrompt(config, [], [], products, [], [], {
      paymentsEnabled: false,
      orderWindow: describeOrderWindow(FOOD_TRUCK, ON),
    })
    expect(on).toContain('# Horario para recibir pedidos')
    expect(on).toContain('pedidos de 18:00 a 23:30')
  })
})
