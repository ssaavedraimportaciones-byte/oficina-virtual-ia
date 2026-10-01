import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import * as auth from '../auth'
import * as llm from '../llm'
import type { LlmProvider } from '../llm'
import * as notifications from '../notifications'
import * as store from '../store'
import { prisma } from '../db'
import { handleIncomingMessage } from '../agentPipeline'
import { QUOTA_REPLY, businessPlan, getAgentUsage, monthlyLimit, startOfMonth } from '../usage'
import type { Business } from '../types'
import * as messagesRoute from '@/app/api/conversations/[id]/messages/route'

const ORIGINAL = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL }
  vi.restoreAllMocks()
})

async function newBusiness(plan: 'FREE' | 'PRO' | 'SIN_DUENO' = 'FREE'): Promise<Business> {
  const business = await store.createBusiness(
    { agentName: 'A', businessName: 'Negocio', industry: 'i', description: 'd', goals: 'g', tone: 'cercano', channels: ['whatsapp'], configuredAt: '' },
    'manicura',
  )
  if (plan !== 'SIN_DUENO') {
    const created = await auth.createUser({ email: `dueno-${randomUUID()}@cupo.test`, password: 'clave-123456', role: 'USER' })
    if (!created.ok) throw new Error(created.reason)
    await prisma.user.update({ where: { id: created.id }, data: { plan } })
    await auth.addBusinessMember(created.id, business.id, 'OWNER')
  }
  return business
}

/** Registra N respuestas del agente en una conversación de la empresa. */
async function agentSpent(business: Business, n: number, at?: Date) {
  const conversation = await store.createConversation({
    businessId: business.id, channel: 'simulador', contactName: 'X', contactHandle: randomUUID(),
  })
  await prisma.message.createMany({
    data: Array.from({ length: n }, () => ({ conversationId: conversation.id, sender: 'agent', text: 'ok', ...(at ? { timestamp: at } : {}) })),
  })
  return conversation
}

describe('límites por plan', () => {
  it('trae valores por defecto y se pueden cambiar por entorno', () => {
    delete process.env.AGENT_REPLIES_FREE
    delete process.env.AGENT_REPLIES_PRO
    expect(monthlyLimit('FREE')).toBe(300)
    expect(monthlyLimit('PRO')).toBe(5000)

    process.env.AGENT_REPLIES_FREE = '50'
    process.env.AGENT_REPLIES_PRO = '-1'
    expect(monthlyLimit('FREE')).toBe(50)
    expect(monthlyLimit('PRO')).toBeNull() // negativo = sin límite

    process.env.AGENT_REPLIES_FREE = 'abc'
    expect(monthlyLimit('FREE')).toBe(300) // valor inválido: cae al por defecto
  })

  it('el plan de la empresa es el del dueño; sin dueño cuenta como PRO', async () => {
    expect(await businessPlan((await newBusiness('FREE')).id)).toBe('FREE')
    expect(await businessPlan((await newBusiness('PRO')).id)).toBe('PRO')
    expect(await businessPlan((await newBusiness('SIN_DUENO')).id)).toBe('PRO')
  })
})

describe('conteo de respuestas', () => {
  it('cuenta solo las del agente de este mes y de esta empresa', async () => {
    const mine = await newBusiness('FREE')
    const other = await newBusiness('FREE')
    await agentSpent(mine, 3)
    await agentSpent(other, 7) // otra empresa: no suma
    const lastMonth = new Date(startOfMonth().getTime() - 24 * 60 * 60 * 1000)
    await agentSpent(mine, 5, lastMonth) // mes pasado: no suma
    const conv = await store.createConversation({ businessId: mine.id, channel: 'simulador', contactName: 'X', contactHandle: randomUUID() })
    await store.appendMessage(conv.id, { sender: 'contact', text: 'hola' }) // del cliente: no suma
    await store.appendMessage(conv.id, { sender: 'human', text: 'hola' }) // de una persona: no suma

    const usage = await getAgentUsage(mine.id)
    expect(usage.used).toBe(3)
  })

  it('el cupo se agota al llegar al límite y no antes', async () => {
    process.env.AGENT_REPLIES_FREE = '4'
    const business = await newBusiness('FREE')
    await agentSpent(business, 3)
    expect((await getAgentUsage(business.id)).exceeded).toBe(false)
    await agentSpent(business, 1)
    expect((await getAgentUsage(business.id)).exceeded).toBe(true)
  })

  it('con el cupo de una empresa agotado, otra empresa no se ve afectada', async () => {
    process.env.AGENT_REPLIES_FREE = '2'
    const gastada = await newBusiness('FREE')
    const intacta = await newBusiness('FREE')
    await agentSpent(gastada, 5)
    expect((await getAgentUsage(gastada.id)).exceeded).toBe(true)
    expect((await getAgentUsage(intacta.id)).exceeded).toBe(false)
  })
})

describe('cupo agotado en el flujo real (WhatsApp/Instagram)', () => {
  let complete: ReturnType<typeof vi.fn>

  beforeEach(() => {
    complete = vi.fn().mockResolvedValue({ text: 'respuesta de la IA', toolCalls: [] })
    vi.spyOn(llm, 'getProvider').mockReturnValue({ id: 'anthropic', model: 'fake', complete, describeError: () => 'e' } as LlmProvider)
    vi.spyOn(notifications, 'notifyNewConversation').mockResolvedValue()
  })

  const incoming = (business: Business, handle: string, text: string) => ({
    business, channel: 'whatsapp' as const, contactHandle: handle, contactName: 'Ana', text, externalId: randomUUID(),
  })

  it('no llama a la IA, no deja al cliente en visto, y avisa al dueño una sola vez', async () => {
    process.env.AGENT_REPLIES_FREE = '2'
    const business = await newBusiness('FREE')
    await agentSpent(business, 2)
    const notify = vi.spyOn(notifications, 'notifyQuotaReached').mockResolvedValue()
    const send = vi.fn().mockResolvedValue(undefined)
    const deps = { send, debounceMs: 0 }
    const handle = randomUUID()

    const first = await handleIncomingMessage(incoming(business, handle, 'hola'), deps)
    expect(first.status).toBe('quota')
    expect(complete).not.toHaveBeenCalled() // no se gastó plata
    expect(send).toHaveBeenCalledWith(QUOTA_REPLY) // el cliente recibe un aviso
    expect(notify).toHaveBeenCalledOnce()

    // Un segundo mensaje: no se repite el aviso al cliente ni el mail al dueño.
    await handleIncomingMessage(incoming(business, handle, 'estás ahí?'), deps)
    expect(send).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledOnce()
    expect(complete).not.toHaveBeenCalled()

    // Los mensajes del cliente igual quedaron guardados para que el equipo los vea.
    const conversation = await store.findConversationByContact(business.id, 'whatsapp', handle)
    expect(conversation?.messages.filter((m) => m.sender === 'contact').map((m) => m.text)).toEqual(['hola', 'estás ahí?'])
  })

  it('con cupo disponible responde normal con la IA', async () => {
    process.env.AGENT_REPLIES_FREE = '100'
    const business = await newBusiness('FREE')
    const send = vi.fn().mockResolvedValue(undefined)

    const result = await handleIncomingMessage(incoming(business, randomUUID(), 'hola'), { send, debounceMs: 0, defer: () => {} })

    expect(result.status).toBe('replied')
    expect(complete).toHaveBeenCalled()
    expect(send).toHaveBeenCalledWith('respuesta de la IA')
  })
})

describe('cupo agotado en el simulador del panel', () => {
  it('responde 429 con un mensaje claro y sin llamar a la IA', async () => {
    process.env.AGENT_REPLIES_FREE = '1'
    const business = await newBusiness('FREE')
    const conversation = await agentSpent(business, 1)
    const complete = vi.fn()
    vi.spyOn(llm, 'getProvider').mockReturnValue({ id: 'anthropic', model: 'fake', complete, describeError: () => 'e' } as LlmProvider)
    vi.spyOn(auth, 'getCurrentUser').mockResolvedValue({
      id: 'u', email: 'u@x.test', role: 'PLATFORM_ADMIN', plan: 'PRO', businesses: [],
    })

    const res = await messagesRoute.POST(
      new NextRequest('http://localhost/api/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sender: 'contact', text: 'hola' }) }),
      { params: Promise.resolve({ id: conversation.id }) },
    )

    expect(res.status).toBe(429)
    expect((await res.json()).error).toContain('límite de 1 respuesta automática')
    expect(complete).not.toHaveBeenCalled()
  })
})
