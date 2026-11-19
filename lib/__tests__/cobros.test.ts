import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { runAgentTool } from '../agentTools'
import { prisma } from '../db'
import * as payments from '../payments'
import * as store from '../store'
import type { Business, Conversation } from '../types'
import * as mpWebhook from '@/app/api/webhooks/mercadopago/route'

/**
 * Cobrar antes de preparar: el pedido no entra a cocina hasta que el pago se
 * confirma (el local con la transferencia, o Mercado Pago solo), lo impago
 * vence y devuelve el stock, y el agente nunca puede darlo por pagado.
 */

async function setup(): Promise<{ business: Business; conversation: Conversation; tortaId: string }> {
  const business = await store.createBusiness(
    {
      agentName: 'Rodri',
      businessName: 'Completos de prueba',
      industry: 'Comida',
      description: 'x',
      goals: 'y',
      tone: 'cercano',
      channels: ['whatsapp'],
      configuredAt: new Date().toISOString(),
    },
    'gastronomia',
  )
  const torta = await store.addProduct({ businessId: business.id, name: 'Completo italiano', price: 3500, stock: 8 })
  const conversation = await store.createConversation({
    businessId: business.id,
    channel: 'simulador',
    contactName: 'Nico',
    contactHandle: `sim-${Date.now()}-${Math.random()}`,
  })
  return { business, conversation, tortaId: torta.id }
}

const ctxOf = (business: Business, conversation: Conversation) => ({ business, conversation })

async function pedir(business: Business, conversation: Conversation, cantidad = 2): Promise<string> {
  return runAgentTool(ctxOf(business, conversation), 'crear_pedido', {
    items: [{ producto: 'Completo italiano', cantidad }],
    nombre_cliente: 'Nico',
  })
}

async function ultimoPedido(businessId: string) {
  return prisma.order.findFirstOrThrow({ where: { businessId }, orderBy: { createdAt: 'desc' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cobrar antes de preparar', () => {
  let business: Business
  let conversation: Conversation
  let tortaId: string

  beforeEach(async () => {
    ;({ business, conversation, tortaId } = await setup())
  })

  it('apagado: el pedido queda como siempre, sin cobro previo', async () => {
    const out = await pedir(business, conversation)
    expect(out).not.toContain('ANTES de preparar')
    expect((await ultimoPedido(business.id)).paymentStatus).toBe('no_aplica')
  })

  it('no deja activarlo sin datos de transferencia ni Mercado Pago', async () => {
    const res = await payments.saveSalesSettings(business.id, { paymentsEnabled: true })
    expect(res.ok).toBe(false)
  })

  it('el agente da los datos de transferencia y el pedido espera el pago con plazo', async () => {
    await payments.saveSalesSettings(business.id, {
      paymentsEnabled: true,
      transferInfo: 'Banco Estado · Cuenta RUT 11.111.111-1',
      holdMinutes: 15,
    })
    const out = await pedir(business, conversation)
    expect(out).toContain('ANTES de preparar')
    expect(out).toContain('Cuenta RUT 11.111.111-1')
    const order = await ultimoPedido(business.id)
    expect(order.paymentStatus).toBe('esperando')
    expect(order.paymentDeadline!.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000)
    // Esperando pago no va a cocina.
    expect(await payments.listKitchenOrders(business.id)).toHaveLength(0)
  })

  it('cliente avisa que transfirió → por revisar; el local confirma → pagado, a cocina y aviso al cliente una sola vez', async () => {
    await payments.saveSalesSettings(business.id, { paymentsEnabled: true, transferInfo: 'Cuenta 123' })
    await pedir(business, conversation)

    const aviso = await runAgentTool(ctxOf(business, conversation), 'avisar_pago', {})
    expect(aviso).toContain('No digas que el pago ya está confirmado')
    const order = await ultimoPedido(business.id)
    expect(order.paymentStatus).toBe('revisar')

    await payments.confirmPayment(order.id, 'transferencia')
    await payments.confirmPayment(order.id, 'transferencia')
    const paid = await ultimoPedido(business.id)
    expect(paid.paymentStatus).toBe('pagado')
    expect(paid.paidAt).not.toBeNull()

    const conv = await store.getConversation(conversation.id)
    const avisos = conv!.messages.filter((m) => m.text.includes('Pago recibido'))
    expect(avisos).toHaveLength(1)

    const cocina = await payments.listKitchenOrders(business.id)
    expect(cocina.map((o) => o.id)).toEqual([order.id])
    expect(await payments.markKitchenPrinted(business.id, order.id)).toBe(true)
    expect(await payments.markKitchenPrinted(business.id, order.id)).toBe(false)
  })

  it('avisar_pago sin pedido pendiente no inventa nada', async () => {
    await payments.saveSalesSettings(business.id, { paymentsEnabled: true, transferInfo: 'Cuenta 123' })
    const out = await runAgentTool(ctxOf(business, conversation), 'avisar_pago', {})
    expect(out).toContain('no tiene un pedido esperando pago')
  })

  it('si vence sin pago se anula y el stock vuelve; un pago que llega tarde lo reactiva', async () => {
    await payments.saveSalesSettings(business.id, { paymentsEnabled: true, transferInfo: 'Cuenta 123' })
    await pedir(business, conversation, 3)
    const order = await ultimoPedido(business.id)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: tortaId } })).stock).toBe(5)

    await prisma.order.update({ where: { id: order.id }, data: { paymentDeadline: new Date(Date.now() - 1000) } })
    expect(await payments.expireUnpaidOrders(business.id)).toBe(1)
    const vencido = await ultimoPedido(business.id)
    expect(vencido.status).toBe('cancelado')
    expect(vencido.paymentStatus).toBe('vencido')
    expect((await prisma.product.findUniqueOrThrow({ where: { id: tortaId } })).stock).toBe(8)

    await payments.confirmPayment(order.id, 'mercadopago')
    const reactivado = await ultimoPedido(business.id)
    expect(reactivado.status).toBe('pendiente')
    expect(reactivado.paymentStatus).toBe('pagado')
    expect((await prisma.product.findUniqueOrThrow({ where: { id: tortaId } })).stock).toBe(5)
  })

  it('sin cobro previo, la cocina recibe el pedido al tiro', async () => {
    await pedir(business, conversation)
    expect(await payments.listKitchenOrders(business.id)).toHaveLength(1)
  })
})

describe('avisos de inventario', () => {
  it('detecta el cruce del mínimo y el agotado', async () => {
    const { business, tortaId } = await setup()
    await payments.saveSalesSettings(business.id, { stockAlertsEnabled: true, stockAlertThreshold: 5 })
    await prisma.product.update({ where: { id: tortaId }, data: { stock: 4 } })
    expect(await payments.alertLowStock(business.id, 'x', [{ productId: tortaId, quantity: 2 }])).toEqual([
      'Completo italiano: quedan 4',
    ])
    expect(await payments.alertLowStock(business.id, 'x', [{ productId: tortaId, quantity: 1 }])).toEqual([])
    await prisma.product.update({ where: { id: tortaId }, data: { stock: 0 } })
    expect(await payments.alertLowStock(business.id, 'x', [{ productId: tortaId, quantity: 1 }])).toEqual([
      'Completo italiano: se agotó',
    ])
  })

  it('apagado no avisa', async () => {
    const { business, tortaId } = await setup()
    await prisma.product.update({ where: { id: tortaId }, data: { stock: 0 } })
    expect(await payments.alertLowStock(business.id, 'x', [{ productId: tortaId, quantity: 3 }])).toEqual([])
  })
})

describe('Mercado Pago', () => {
  function mockMp(payment: { status: string; external_reference: string; transaction_amount: number }) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/users/me')) return new Response('{}', { status: 200 })
        if (url.includes('/checkout/preferences'))
          return new Response(JSON.stringify({ init_point: 'https://mpago.la/abc' }), { status: 201 })
        if (url.includes('/v1/payments/')) return new Response(JSON.stringify(payment), { status: 200 })
        return new Response('{}', { status: 404 })
      }),
    )
  }

  const webhook = (businessId: string, id: string) =>
    mpWebhook.POST(
      new NextRequest(`http://localhost/api/webhooks/mercadopago?b=${businessId}`, {
        method: 'POST',
        body: JSON.stringify({ type: 'payment', data: { id } }),
      }),
    )

  it('manda el link y lo confirma solo cuando la API dice que se aprobó con el monto correcto', async () => {
    const { business, conversation } = await setup()
    mockMp({ status: 'approved', external_reference: 'x', transaction_amount: 0 })
    await payments.saveSalesSettings(business.id, { paymentsEnabled: true, mercadoPagoToken: 'APP_USR-token-de-prueba' })
    const out = await pedir(business, conversation)
    expect(out).toContain('https://mpago.la/abc')
    const order = await ultimoPedido(business.id)

    // Monto menor al total: no se marca pagado.
    mockMp({ status: 'approved', external_reference: order.id, transaction_amount: 100 })
    await webhook(business.id, '111')
    expect((await ultimoPedido(business.id)).paymentStatus).toBe('esperando')

    // Pendiente en Mercado Pago: tampoco.
    mockMp({ status: 'pending', external_reference: order.id, transaction_amount: order.total })
    await webhook(business.id, '112')
    expect((await ultimoPedido(business.id)).paymentStatus).toBe('esperando')

    mockMp({ status: 'approved', external_reference: order.id, transaction_amount: order.total })
    const res = await webhook(business.id, '113')
    expect(res.status).toBe(200)
    const paid = await ultimoPedido(business.id)
    expect(paid.paymentStatus).toBe('pagado')
    expect(paid.paymentMethod).toBe('mercadopago')
  })

  it('un pago aprobado de otro negocio no marca pagado un pedido ajeno', async () => {
    const a = await setup()
    const b = await setup()
    mockMp({ status: 'approved', external_reference: 'x', transaction_amount: 0 })
    await payments.saveSalesSettings(a.business.id, { paymentsEnabled: true, mercadoPagoToken: 'APP_USR-token-a' })
    await payments.saveSalesSettings(b.business.id, { paymentsEnabled: true, transferInfo: 'Cuenta B' })
    await pedir(b.business, b.conversation)
    const orderB = await ultimoPedido(b.business.id)

    mockMp({ status: 'approved', external_reference: orderB.id, transaction_amount: orderB.total })
    await webhook(a.business.id, '200')
    expect((await ultimoPedido(b.business.id)).paymentStatus).toBe('esperando')
  })

  it('no guarda un token que Mercado Pago no reconoce', async () => {
    const { business } = await setup()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    const res = await payments.saveSalesSettings(business.id, { mercadoPagoToken: 'APP_USR-malo-malo' })
    expect(res.ok).toBe(false)
    expect((await payments.getSalesSettings(business.id)).mercadoPagoConnected).toBe(false)
  })
})
