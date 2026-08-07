import { describe, expect, it } from 'vitest'
import * as store from '../store'

async function newBusiness() {
  return store.createBusiness(
    { agentName: 'A', businessName: 'Negocio de prueba', industry: 'i', description: 'd',
      goals: 'g', tone: 'cercano', channels: ['whatsapp'], configuredAt: '' },
    'manicura',
  )
}

describe('getBusinessAnalytics', () => {
  it('un negocio recién creado arranca todo en cero', async () => {
    const business = await newBusiness()
    const stats = await store.getBusinessAnalytics(business.id)
    expect(stats).toEqual({
      conversationCount: 0,
      openConversations: 0,
      messageCount: 0,
      appointmentCount: 0,
      confirmedAppointments: 0,
      orderCount: 0,
      pendingOrders: 0,
      revenueTotal: 0,
      soldOutProducts: 0,
      knowledgeCount: 0,
    })
  })

  it('cuenta conversaciones abiertas y mensajes', async () => {
    const business = await newBusiness()
    const c1 = await store.createConversation({
      businessId: business.id, channel: 'whatsapp', contactName: 'A', contactHandle: '1',
    })
    await store.createConversation({
      businessId: business.id, channel: 'whatsapp', contactName: 'B', contactHandle: '2',
    })
    await store.appendMessage(c1.id, { sender: 'contact', text: 'hola' })
    await store.appendMessage(c1.id, { sender: 'agent', text: 'hola, en qué te ayudo' })
    await store.setConversationStatus(c1.id, 'cerrada')

    const stats = await store.getBusinessAnalytics(business.id)
    expect(stats.conversationCount).toBe(2)
    expect(stats.openConversations).toBe(1)
    expect(stats.messageCount).toBe(2)
  })

  it('el facturado no cuenta pedidos cancelados', async () => {
    const business = await newBusiness()
    await store.addProduct({ businessId: business.id, name: 'Producto', price: 1000, stock: 5 })

    const ok = await store.createOrder({
      businessId: business.id,
      conversationId: null,
      contactName: 'Cliente',
      contactHandle: '5491100000000',
      requested: [{ producto: 'Producto', cantidad: 2 }],
      note: '',
    })
    if (!ok.ok) throw new Error('no se pudo crear el pedido')

    const cancelledOrder = await store.createOrder({
      businessId: business.id,
      conversationId: null,
      contactName: 'Otro cliente',
      contactHandle: '5491100000001',
      requested: [{ producto: 'Producto', cantidad: 1 }],
      note: '',
    })
    if (!cancelledOrder.ok) throw new Error('no se pudo crear el segundo pedido')
    await store.setOrderStatus(cancelledOrder.order.id, 'cancelado')

    const stats = await store.getBusinessAnalytics(business.id)
    expect(stats.orderCount).toBe(2)
    expect(stats.pendingOrders).toBe(1)
    expect(stats.revenueTotal).toBe(ok.order.total)
  })

  it('cuenta productos agotados y turnos confirmados', async () => {
    const business = await newBusiness()
    await store.addProduct({ businessId: business.id, name: 'Agotado', price: 500, stock: 0 })
    await store.addProduct({ businessId: business.id, name: 'Con stock', price: 500, stock: 5 })

    const service = await store.addService({ businessId: business.id, name: 'Corte', durationMinutes: 30, price: '$1000' })
    await store.addAppointment({
      businessId: business.id,
      conversationId: null,
      serviceId: service.id,
      serviceName: service.name,
      contactName: 'Cliente',
      contactHandle: '5491100000000',
      startsAt: '2026-08-10T14:00',
      durationMinutes: 30,
    })

    const stats = await store.getBusinessAnalytics(business.id)
    expect(stats.soldOutProducts).toBe(1)
    expect(stats.appointmentCount).toBe(1)
    expect(stats.confirmedAppointments).toBe(1)
  })
})
