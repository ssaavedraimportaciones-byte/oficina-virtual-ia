import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import * as auth from '../auth'
import type { SessionUser } from '../auth'
import * as llm from '../llm'
import type { LlmProvider } from '../llm'
import * as notifications from '../notifications'
import * as store from '../store'
import { prisma } from '../db'
import { handleIncomingMessage } from '../agentPipeline'
import {
  DEFAULT_MAINTENANCE_REPLY,
  createAnnouncement,
  getBillingOverview,
  getMaintenance,
  listActiveAnnouncements,
  setMaintenance,
} from '../platform'
import { getAgentUsage } from '../usage'
import type { Business } from '../types'

import * as userRoute from '@/app/api/admin/users/[id]/route'
import * as adminBusinessRoute from '@/app/api/admin/businesses/[id]/route'
import * as platformRoute from '@/app/api/admin/platform/route'
import * as announcementsRoute from '@/app/api/admin/announcements/route'
import * as announcementRoute from '@/app/api/admin/announcements/[id]/route'
import * as businessRoute from '@/app/api/businesses/[id]/route'
import * as messagesRoute from '@/app/api/conversations/[id]/messages/route'

const ORIGINAL = { ...process.env }

const ADMIN: SessionUser = { id: 'admin-1', email: 'admin@x.test', role: 'PLATFORM_ADMIN', plan: 'PRO', businesses: [] }
const normalUser = (businessId?: string): SessionUser => ({
  id: 'u-1', email: 'u@x.test', role: 'USER', plan: 'FREE',
  businesses: businessId ? [{ businessId, role: 'OWNER' }] : [],
})

const as = (user: SessionUser | null) => vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(user)
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/x', {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

async function newBusiness(): Promise<Business> {
  return store.createBusiness(
    { agentName: 'A', businessName: `Negocio ${randomUUID().slice(0, 6)}`, industry: 'i', description: 'd', goals: 'g', tone: 'cercano', channels: ['whatsapp'], configuredAt: '' },
    'manicura',
  )
}

async function newUser(plan: 'FREE' | 'PRO' = 'FREE', stripeSubscriptionId?: string) {
  const created = await auth.createUser({ email: `u-${randomUUID()}@prop.test`, password: 'clave-123456', role: 'USER' })
  if (!created.ok) throw new Error(created.reason)
  await prisma.user.update({ where: { id: created.id }, data: { plan, stripeSubscriptionId, stripeCustomerId: stripeSubscriptionId ? 'cus_test' : null } })
  return created.id
}

// El mantenimiento y los avisos viven en la base compartida: se dejan apagados al terminar.
async function resetPlatform() {
  await prisma.platformSetting.deleteMany()
  await prisma.announcement.deleteMany()
}
beforeAll(resetPlatform)
afterAll(resetPlatform)
afterEach(async () => {
  process.env = { ...ORIGINAL }
  vi.restoreAllMocks()
  await resetPlatform()
})

describe('permisos: solo el dueño de la plataforma', () => {
  const calls: Array<[string, () => Promise<Response>]> = [
    ['cambiar plan', () => userRoute.PATCH(req('PATCH', { plan: 'PRO' }), ctx('x'))],
    ['borrar usuario', () => userRoute.DELETE(req('DELETE'), ctx('x'))],
    ['notas y límite de una empresa', () => adminBusinessRoute.PATCH(req('PATCH', { adminNotes: 'x' }), ctx('x'))],
    ['leer el mantenimiento', () => platformRoute.GET()],
    ['prender el mantenimiento', () => platformRoute.PUT(req('PUT', { enabled: true, message: 'x' }))],
    ['listar avisos', () => announcementsRoute.GET()],
    ['crear aviso', () => announcementsRoute.POST(req('POST', { message: 'x' }))],
    ['ocultar aviso', () => announcementRoute.PATCH(req('PATCH', { active: false }), ctx('x'))],
    ['borrar aviso', () => announcementRoute.DELETE(req('DELETE'), ctx('x'))],
  ]

  it.each(calls)('%s: un cliente normal recibe 403', async (_name, call) => {
    as(normalUser())
    expect((await call()).status).toBe(403)
  })

  it.each(calls)('%s: sin sesión recibe 401', async (_name, call) => {
    as(null)
    expect((await call()).status).toBe(401)
  })

  it('un cliente no puede apagar el sistema ni darse PRO', async () => {
    const userId = await newUser('FREE')
    as(normalUser())
    await platformRoute.PUT(req('PUT', { enabled: true, message: 'hack' }))
    await userRoute.PATCH(req('PATCH', { plan: 'PRO' }), ctx(userId))
    expect((await getMaintenance()).enabled).toBe(false)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe('FREE')
  })
})

describe('cobros: plan manual y resumen', () => {
  it('el administrador da y quita PRO de cortesía', async () => {
    const userId = await newUser('FREE')
    as(ADMIN)
    expect((await userRoute.PATCH(req('PATCH', { plan: 'PRO' }), ctx(userId))).status).toBe(200)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe('PRO')
    expect((await userRoute.PATCH(req('PATCH', { plan: 'FREE' }), ctx(userId))).status).toBe(200)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe('FREE')
  })

  it('valida el plan y el usuario', async () => {
    as(ADMIN)
    expect((await userRoute.PATCH(req('PATCH', { plan: 'GOLD' }), ctx('x'))).status).toBe(400)
    expect((await userRoute.PATCH(req('PATCH', {}), ctx('x'))).status).toBe(400)
    expect((await userRoute.PATCH(req('PATCH', { plan: 'PRO' }), ctx(randomUUID()))).status).toBe(404)
  })

  it('el resumen distingue a quien paga por Stripe del PRO de cortesía', async () => {
    const before = (await getBillingOverview()).totals
    await newUser('PRO', 'sub_123') // paga
    await newUser('PRO') // cortesía
    await newUser('FREE')

    const after = await getBillingOverview()
    expect(after.totals.paying - before.paying).toBe(1)
    expect(after.totals.courtesy - before.courtesy).toBe(1)
    expect(after.totals.free - before.free).toBe(1)
    expect(after.totals.pro - before.pro).toBe(2)
    const courtesy = after.users.filter((u) => u.courtesy)
    expect(courtesy.every((u) => u.plan === 'PRO' && !u.stripeSubscriptionId)).toBe(true)
  })

  it('suma el consumo de las empresas de cada cliente', async () => {
    const userId = await newUser('FREE')
    const business = await newBusiness()
    await auth.addBusinessMember(userId, business.id, 'OWNER')
    const conversation = await store.createConversation({ businessId: business.id, channel: 'simulador', contactName: 'X', contactHandle: randomUUID() })
    await prisma.message.createMany({ data: [1, 2, 3].map(() => ({ conversationId: conversation.id, sender: 'agent', text: 'ok' })) })

    const row = (await getBillingOverview()).users.find((u) => u.id === userId)!
    expect(row.repliesThisMonth).toBe(3)
    expect(row.businesses[0].name).toBe(business.config.businessName)
  })
})

describe('acotaciones por empresa: notas y límite manual', () => {
  it('guarda notas internas y un límite propio, y se puede volver al del plan', async () => {
    const business = await newBusiness()
    as(ADMIN)
    const res = await adminBusinessRoute.PATCH(req('PATCH', { adminNotes: 'Cliente piloto, cobrar en marzo', replyLimitOverride: 40 }), ctx(business.id))
    expect(res.status).toBe(200)

    const row = await prisma.business.findUniqueOrThrow({ where: { id: business.id } })
    expect(row.adminNotes).toBe('Cliente piloto, cobrar en marzo')
    expect(row.replyLimitOverride).toBe(40)

    await adminBusinessRoute.PATCH(req('PATCH', { replyLimitOverride: null }), ctx(business.id))
    expect((await prisma.business.findUniqueOrThrow({ where: { id: business.id } })).replyLimitOverride).toBeNull()
  })

  it('valida los datos', async () => {
    const business = await newBusiness()
    as(ADMIN)
    expect((await adminBusinessRoute.PATCH(req('PATCH', { replyLimitOverride: -5 }), ctx(business.id))).status).toBe(400)
    expect((await adminBusinessRoute.PATCH(req('PATCH', { replyLimitOverride: 1.5 }), ctx(business.id))).status).toBe(400)
    expect((await adminBusinessRoute.PATCH(req('PATCH', { adminNotes: 'x'.repeat(2001) }), ctx(business.id))).status).toBe(400)
    expect((await adminBusinessRoute.PATCH(req('PATCH', { adminNotes: 'x' }), ctx(randomUUID()))).status).toBe(404)
  })

  it('las notas internas NUNCA llegan al panel de la empresa', async () => {
    const business = await newBusiness()
    const owner = await newUser('FREE')
    await auth.addBusinessMember(owner, business.id, 'OWNER')
    as(ADMIN)
    await adminBusinessRoute.PATCH(req('PATCH', { adminNotes: 'SECRETO-INTERNO-123', replyLimitOverride: 7 }), ctx(business.id))

    as(normalUser(business.id))
    const res = await businessRoute.GET(req('GET'), ctx(business.id))
    expect(res.status).toBe(200)
    const text = JSON.stringify(await res.json())
    expect(text).not.toContain('SECRETO-INTERNO-123')
    expect(text).not.toMatch(/adminNotes|replyLimitOverride/)
    // Ni por el mapeo interno de la empresa.
    expect(JSON.stringify(await store.getBusiness(business.id))).not.toContain('SECRETO-INTERNO-123')
  })

  it('el límite manual manda sobre el del plan', async () => {
    process.env.AGENT_REPLIES_FREE = '300'
    const business = await newBusiness()
    const owner = await newUser('FREE')
    await auth.addBusinessMember(owner, business.id, 'OWNER')
    const conversation = await store.createConversation({ businessId: business.id, channel: 'simulador', contactName: 'X', contactHandle: randomUUID() })
    await prisma.message.createMany({ data: [1, 2].map(() => ({ conversationId: conversation.id, sender: 'agent', text: 'ok' })) })

    expect(await getAgentUsage(business.id)).toMatchObject({ limit: 300, exceeded: false })
    await prisma.business.update({ where: { id: business.id }, data: { replyLimitOverride: 2 } })
    expect(await getAgentUsage(business.id)).toMatchObject({ limit: 2, exceeded: true })
    await prisma.business.update({ where: { id: business.id }, data: { replyLimitOverride: 0 } })
    expect((await getAgentUsage(business.id)).exceeded).toBe(true) // 0 = empresa suspendida
  })
})

describe('mensajes de reparación: modo mantenimiento y contingencia', () => {
  let complete: ReturnType<typeof vi.fn>

  beforeEach(() => {
    complete = vi.fn().mockResolvedValue({ text: 'respuesta de la IA', toolCalls: [] })
    vi.spyOn(llm, 'getProvider').mockReturnValue({ id: 'anthropic', model: 'fake', complete, describeError: () => 'e' } as LlmProvider)
    vi.spyOn(notifications, 'notifyNewConversation').mockResolvedValue()
  })

  const incoming = (business: Business, handle: string, text: string) => ({
    business, channel: 'whatsapp' as const, contactHandle: handle, contactName: 'Ana', text, externalId: randomUUID(),
  })

  it('se configura y lee; el mensaje no puede quedar vacío', async () => {
    as(ADMIN)
    expect((await getMaintenance())).toEqual({ enabled: false, message: DEFAULT_MAINTENANCE_REPLY })
    const res = await platformRoute.PUT(req('PUT', { enabled: true, message: 'Estamos reparando, volvemos en 10 minutos.' }))
    expect(res.status).toBe(200)
    expect(await getMaintenance()).toEqual({ enabled: true, message: 'Estamos reparando, volvemos en 10 minutos.' })
    expect((await platformRoute.PUT(req('PUT', { enabled: true, message: '   ' }))).status).toBe(400)
  })

  it('con el mantenimiento prendido el agente no llama a la IA y el cliente no queda en visto', async () => {
    await setMaintenance({ enabled: true, message: 'Estamos reparando, volvemos pronto.' })
    const business = await newBusiness()
    const send = vi.fn().mockResolvedValue(undefined)
    const deps = { send, debounceMs: 0 }
    const handle = randomUUID()

    const first = await handleIncomingMessage(incoming(business, handle, 'hola'), deps)
    expect(first.status).toBe('maintenance')
    expect(complete).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledWith('Estamos reparando, volvemos pronto.')

    // Un segundo mensaje no repite el aviso; los mensajes del cliente se guardan.
    await handleIncomingMessage(incoming(business, handle, 'sigues ahí?'), deps)
    expect(send).toHaveBeenCalledOnce()
    const conversation = await store.findConversationByContact(business.id, 'whatsapp', handle)
    expect(conversation?.messages.filter((m) => m.sender === 'contact').map((m) => m.text)).toEqual(['hola', 'sigues ahí?'])
  })

  it('al apagar el mantenimiento el agente vuelve a responder solo', async () => {
    await setMaintenance({ enabled: true, message: 'Mantenimiento' })
    await setMaintenance({ enabled: false, message: 'Mantenimiento' })
    const business = await newBusiness()
    const send = vi.fn().mockResolvedValue(undefined)

    const result = await handleIncomingMessage(incoming(business, randomUUID(), 'hola'), { send, debounceMs: 0, defer: () => {} })
    expect(result.status).toBe('replied')
    expect(send).toHaveBeenCalledWith('respuesta de la IA')
  })

  it('si la IA falla, el cliente recibe el mensaje de contingencia en vez de silencio', async () => {
    complete.mockRejectedValue(new Error('Anthropic caído'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await setMaintenance({ enabled: false, message: 'Tuvimos un problema técnico, te escribimos en breve.' })
    const business = await newBusiness()
    const send = vi.fn().mockResolvedValue(undefined)
    const deps = { send, debounceMs: 0 }
    const handle = randomUUID()

    const result = await handleIncomingMessage(incoming(business, handle, 'hola'), deps)
    expect(result.status).toBe('degraded')
    expect(send).toHaveBeenCalledWith('Tuvimos un problema técnico, te escribimos en breve.')

    // Si sigue fallando, no se le repite el mismo aviso al cliente.
    await handleIncomingMessage(incoming(business, handle, 'hola?'), deps)
    expect(send).toHaveBeenCalledOnce()
  })

  it('el simulador del panel responde 503 durante el mantenimiento', async () => {
    await setMaintenance({ enabled: true, message: 'Mantenimiento' })
    const business = await newBusiness()
    const conversation = await store.createConversation({ businessId: business.id, channel: 'simulador', contactName: 'X', contactHandle: randomUUID() })
    as(ADMIN)

    const res = await messagesRoute.POST(req('POST', { sender: 'contact', text: 'hola' }), ctx(conversation.id))
    expect(res.status).toBe(503)
    expect(complete).not.toHaveBeenCalled()
  })
})

describe('avisos a los clientes', () => {
  it('se crean, se ocultan y se borran; los clientes solo ven los activos', async () => {
    as(ADMIN)
    const created = await announcementsRoute.POST(req('POST', { message: 'Hoy a las 23:00 hacemos una mejora.', level: 'maintenance' }))
    expect(created.status).toBe(200)
    const { announcement } = await created.json()
    expect(announcement.level).toBe('maintenance')
    expect((await listActiveAnnouncements()).map((a) => a.message)).toContain('Hoy a las 23:00 hacemos una mejora.')

    await announcementRoute.PATCH(req('PATCH', { active: false }), ctx(announcement.id))
    expect((await listActiveAnnouncements()).map((a) => a.id)).not.toContain(announcement.id)
    expect(((await (await announcementsRoute.GET()).json()).announcements as Array<{ id: string }>).map((a) => a.id)).toContain(announcement.id)

    await announcementRoute.DELETE(req('DELETE'), ctx(announcement.id))
    expect(((await (await announcementsRoute.GET()).json()).announcements as Array<{ id: string }>).map((a) => a.id)).not.toContain(announcement.id)
  })

  it('nivel por defecto "info", y valida mensaje y nivel', async () => {
    as(ADMIN)
    const ok = await announcementsRoute.POST(req('POST', { message: 'Novedad' }))
    expect((await ok.json()).announcement.level).toBe('info')
    expect((await announcementsRoute.POST(req('POST', { message: '' }))).status).toBe(400)
    expect((await announcementsRoute.POST(req('POST', { message: 'x', level: 'urgente' }))).status).toBe(400)
    expect((await announcementsRoute.POST(req('POST', { message: 'x'.repeat(501) }))).status).toBe(400)
    expect((await announcementRoute.PATCH(req('PATCH', { active: false }), ctx(randomUUID()))).status).toBe(404)
  })

  it('el panel de los clientes muestra a lo sumo 5 avisos, los más nuevos primero', async () => {
    for (let i = 1; i <= 7; i += 1) await createAnnouncement({ message: `Aviso ${i}`, level: 'info' })
    const active = await listActiveAnnouncements()
    expect(active).toHaveLength(5)
    expect(active[0].message).toBe('Aviso 7')
  })
})
