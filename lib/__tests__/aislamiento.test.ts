import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import * as auth from '../auth'
import type { SessionUser } from '../auth'
import * as store from '../store'
import { prisma } from '../db'
import type { Business } from '../types'

import * as businessRoute from '@/app/api/businesses/[id]/route'
import * as catalogRoute from '@/app/api/businesses/[id]/catalogo/route'
import * as knowledgeListRoute from '@/app/api/businesses/[id]/knowledge/route'
import * as agendaRoute from '@/app/api/businesses/[id]/agenda/route'
import * as conversationsRoute from '@/app/api/businesses/[id]/conversations/route'
import * as conversationRoute from '@/app/api/conversations/[id]/route'
import * as messagesRoute from '@/app/api/conversations/[id]/messages/route'
import * as productRoute from '@/app/api/products/[id]/route'
import * as orderRoute from '@/app/api/orders/[id]/route'
import * as serviceRoute from '@/app/api/services/[id]/route'
import * as knowledgeRoute from '@/app/api/knowledge/[id]/route'
import * as appointmentRoute from '@/app/api/appointments/[id]/route'
import * as businessesRoute from '@/app/api/businesses/route'

/**
 * Multi-tenant: la regla que no se puede romper es que una empresa nunca vea
 * ni toque los datos de otra. Acá se llaman las rutas REALES de la API como
 * si fuera el dueño de la empresa A, apuntando a recursos de la empresa B, y
 * se comprueba (1) que responden "no encontrado" y (2) que los datos de B
 * quedaron intactos. Cada recurso tiene además su caso de control: el dueño
 * de B sí puede, para que la prueba no pase "en vacío".
 */

interface Tenant {
  user: SessionUser
  business: Business
  productId: string
  serviceId: string
  appointmentId: string
  orderId: string
  knowledgeId: string
  conversationId: string
}

async function createTenant(label: string): Promise<Tenant> {
  const created = await auth.createUser({
    email: `${label}-${randomUUID()}@aislamiento.test`,
    password: 'clave-123456',
    role: 'USER',
  })
  if (!created.ok) throw new Error(created.reason)

  const business = await store.createBusiness(
    {
      agentName: 'A', businessName: `Empresa ${label}`, industry: 'i', description: 'd',
      goals: 'g', tone: 'cercano', channels: ['whatsapp'], configuredAt: '',
    },
    'manicura',
  )
  await auth.addBusinessMember(created.id, business.id, 'OWNER')

  const service = await store.addService({
    businessId: business.id, name: 'Semi', durationMinutes: 60, price: '$1',
  })
  const product = await store.addProduct({
    businessId: business.id, name: 'Esmalte', price: 1000, stock: 10,
  })
  const conversation = await store.createConversation({
    businessId: business.id, channel: 'simulador', contactName: 'Cliente', contactHandle: randomUUID(),
  })
  const appointment = await store.addAppointment({
    businessId: business.id, conversationId: conversation.id, serviceId: service.id,
    serviceName: service.name, contactName: 'Cliente', contactHandle: 'x',
    startsAt: '2099-01-05T10:00', durationMinutes: 60,
  })
  const order = await store.createOrder({
    businessId: business.id, conversationId: conversation.id, contactName: 'Cliente',
    contactHandle: 'x', requested: [{ producto: 'Esmalte', cantidad: 1 }], note: '',
  })
  if (!order.ok) throw new Error(order.reason)
  const knowledge = await store.addKnowledgeEntry({
    businessId: business.id, title: 'Precios', content: 'Semi: $1', sourceType: 'manual', sourceUrl: null,
  })

  const user = (await auth.getUserProfile(created.id)) as unknown as { id: string; email: string }
  return {
    user: { id: user.id, email: user.email, role: 'USER', plan: 'FREE', businesses: [{ businessId: business.id, role: 'OWNER' }] },
    business,
    productId: product.id,
    serviceId: service.id,
    appointmentId: appointment.id,
    orderId: order.order.id,
    knowledgeId: knowledge.id,
    conversationId: conversation.id,
  }
}

function actAs(user: SessionUser) {
  vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(user)
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/x', {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

let A: Tenant
let B: Tenant

beforeAll(async () => {
  A = await createTenant('a')
  B = await createTenant('b')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('aislamiento entre empresas: lecturas', () => {
  const reads: Array<[string, (t: Tenant) => Promise<Response>]> = [
    ['GET negocio', (t) => businessRoute.GET(req('GET'), ctx(t.business.id))],
    ['GET catálogo', (t) => catalogRoute.GET(req('GET'), ctx(t.business.id))],
    ['GET conocimiento', (t) => knowledgeListRoute.GET(req('GET'), ctx(t.business.id))],
    ['GET agenda', (t) => agendaRoute.GET(req('GET'), ctx(t.business.id))],
    ['GET conversaciones', (t) => conversationsRoute.GET(req('GET'), ctx(t.business.id))],
    ['GET conversación', (t) => conversationRoute.GET(req('GET'), ctx(t.conversationId))],
  ]

  it.each(reads)('%s: A no puede leer lo de B', async (_name, call) => {
    actAs(A.user)
    const res = await call(B)
    expect(res.status).toBe(404)
  })

  it.each(reads)('%s: control, B sí puede leer lo suyo', async (_name, call) => {
    actAs(B.user)
    const res = await call(B)
    expect(res.status).toBe(200)
  })

  it('el listado de negocios de A no incluye los de B', async () => {
    actAs(A.user)
    const res = await businessesRoute.GET()
    const { businesses } = await res.json()
    const ids = businesses.map((b: { id: string }) => b.id)
    expect(ids).toContain(A.business.id)
    expect(ids).not.toContain(B.business.id)
  })

  it('la respuesta pública de un negocio nunca incluye los tokens de canales', async () => {
    actAs(B.user)
    const res = await businessRoute.GET(req('GET'), ctx(B.business.id))
    const text = JSON.stringify(await res.json())
    expect(text).not.toMatch(/AccessToken|accessToken/)
  })
})

describe('aislamiento entre empresas: escrituras', () => {
  it('A no puede modificar ni borrar la configuración de B', async () => {
    actAs(A.user)
    const config = { agentName: 'Hack', businessName: 'Hack', industry: 'i', description: 'd', goals: 'g', tone: 'cercano', channels: ['whatsapp'] }
    expect((await businessRoute.PUT(req('PUT', config), ctx(B.business.id))).status).toBe(404)
    expect((await businessRoute.DELETE(req('DELETE'), ctx(B.business.id))).status).toBe(404)

    const after = await store.getBusiness(B.business.id)
    expect(after?.config.businessName).toBe('Empresa b')
  })

  it('A no puede crear datos dentro de B', async () => {
    actAs(A.user)
    expect((await catalogRoute.POST(req('POST', { name: 'Hack', price: 1, stock: 1 }), ctx(B.business.id))).status).toBe(404)
    expect((await knowledgeListRoute.POST(req('POST', { title: 'Hack', content: 'x' }), ctx(B.business.id))).status).toBe(404)
    expect((await agendaRoute.POST(req('POST', { name: 'Hack', durationMinutes: 30, price: '$1' }), ctx(B.business.id))).status).toBe(404)
    expect((await agendaRoute.PUT(req('PUT', { hours: [null, null, null, null, null, null, null] }), ctx(B.business.id))).status).toBe(404)
    expect((await conversationsRoute.POST(req('POST', { channel: 'simulador', contactName: 'x', contactHandle: 'x' }), ctx(B.business.id))).status).toBe(404)

    expect(await store.listProducts(B.business.id)).toHaveLength(1)
    expect(await store.listServices(B.business.id)).toHaveLength(1)
    expect(await store.listKnowledge(B.business.id)).toHaveLength(1)
  })

  it('A no puede tocar productos, pedidos, servicios, conocimiento ni horas de B por su ID', async () => {
    actAs(A.user)
    expect((await productRoute.PATCH(req('PATCH', { stock: 0 }), ctx(B.productId))).status).toBe(404)
    expect((await productRoute.DELETE(req('DELETE'), ctx(B.productId))).status).toBe(404)
    expect((await orderRoute.PATCH(req('PATCH', { status: 'cancelado' }), ctx(B.orderId))).status).toBe(404)
    expect((await serviceRoute.DELETE(req('DELETE'), ctx(B.serviceId))).status).toBe(404)
    expect((await knowledgeRoute.DELETE(req('DELETE'), ctx(B.knowledgeId))).status).toBe(404)
    expect((await appointmentRoute.DELETE(req('DELETE'), ctx(B.appointmentId))).status).toBe(404)

    // Nada cambió en la base.
    const [product] = await store.listProducts(B.business.id)
    expect(product.stock).toBe(9) // 10 menos el pedido de la prueba
    expect((await store.listOrders(B.business.id))[0].status).toBe('pendiente')
    expect(await store.listServices(B.business.id)).toHaveLength(1)
    expect(await store.listKnowledge(B.business.id)).toHaveLength(1)
    expect((await store.listAppointments(B.business.id))[0].status).toBe('confirmado')
  })

  it('A no puede escribirle ni pausar al agente en una conversación de B', async () => {
    actAs(A.user)
    expect((await messagesRoute.POST(req('POST', { sender: 'human', text: 'hola' }), ctx(B.conversationId))).status).toBe(404)
    expect((await conversationRoute.PATCH(req('PATCH', { agentPaused: true }), ctx(B.conversationId))).status).toBe(404)

    const conversation = await store.getConversation(B.conversationId)
    expect(conversation?.messages).toHaveLength(0)
    expect(conversation?.agentPaused).toBe(false)
  })

  it('controles: el dueño de B sí puede operar sobre lo suyo', async () => {
    actAs(B.user)
    expect((await productRoute.PATCH(req('PATCH', { stock: 7 }), ctx(B.productId))).status).toBe(200)
    expect((await orderRoute.PATCH(req('PATCH', { status: 'entregado' }), ctx(B.orderId))).status).toBe(200)
    expect((await conversationRoute.PATCH(req('PATCH', { agentPaused: true }), ctx(B.conversationId))).status).toBe(200)
  })
})

describe('aislamiento entre empresas: sin sesión', () => {
  it('sin usuario, ninguna ruta de datos responde 200', async () => {
    vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(null)
    const calls = [
      businessRoute.GET(req('GET'), ctx(A.business.id)),
      catalogRoute.GET(req('GET'), ctx(A.business.id)),
      conversationRoute.GET(req('GET'), ctx(A.conversationId)),
      productRoute.DELETE(req('DELETE'), ctx(A.productId)),
    ]
    for (const res of await Promise.all(calls)) expect([401, 404]).toContain(res.status)
  })

  it('un STAFF de A tampoco entra a B', async () => {
    const staff: SessionUser = { ...A.user, businesses: [{ businessId: A.business.id, role: 'STAFF' }] }
    actAs(staff)
    expect((await businessRoute.GET(req('GET'), ctx(B.business.id))).status).toBe(404)
    expect((await businessRoute.GET(req('GET'), ctx(A.business.id))).status).toBe(200)
  })
})

describe('aislamiento entre empresas: el agente y los canales', () => {
  it('las conversaciones se separan por empresa aunque el contacto sea el mismo número', async () => {
    const handle = `5491100${Date.now() % 100000}`
    const a = await store.findOrCreateConversation({ businessId: A.business.id, channel: 'whatsapp', contactName: 'X', contactHandle: handle })
    const b = await store.findOrCreateConversation({ businessId: B.business.id, channel: 'whatsapp', contactName: 'X', contactHandle: handle })
    expect(a.conversation.id).not.toBe(b.conversation.id)
    expect(await store.listConversations(A.business.id).then((c) => c.every((x) => x.businessId === A.business.id))).toBe(true)
  })

  it('un mensaje entrante se reparte solo por el número conectado, sin adivinar empresa', async () => {
    delete process.env.SINGLE_BUSINESS_MODE
    expect(await store.findBusinessByChannelId('whatsapp', `desconocido-${randomUUID()}`)).toBeNull()
  })

  it('borrar una empresa no se lleva datos de otra', async () => {
    const temp = await createTenant('temp')
    await store.deleteBusiness(temp.business.id)
    expect(await store.getBusiness(temp.business.id)).toBeNull()
    expect(await store.listProducts(B.business.id)).toHaveLength(1)
    expect(await prisma.conversation.count({ where: { businessId: B.business.id } })).toBeGreaterThan(0)
  })
})
