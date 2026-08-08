import { describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'crypto'
import * as store from '../store'
import * as email from '../email'
import { addBusinessMember, createUser } from '../auth'
import { notifyNewConversation } from '../notifications'

function uniqueEmail(): string {
  return `test-${randomUUID()}@agentsapp.test`
}

async function newBusiness() {
  return store.createBusiness(
    { agentName: 'A', businessName: 'Negocio de prueba', industry: 'i', description: 'd',
      goals: 'g', tone: 'cercano', channels: ['whatsapp'], configuredAt: '' },
    'manicura',
  )
}

describe('notifyNewConversation', () => {
  it('avisa por mail a cada dueño (OWNER) del negocio', async () => {
    const business = await newBusiness()
    const email1 = uniqueEmail()
    const email2 = uniqueEmail()
    const owner1 = await createUser({ email: email1, password: 'x'.repeat(10), role: 'USER' })
    const owner2 = await createUser({ email: email2, password: 'x'.repeat(10), role: 'USER' })
    if (!owner1.ok || !owner2.ok) throw new Error('setup falló')
    await addBusinessMember(owner1.id, business.id, 'OWNER')
    await addBusinessMember(owner2.id, business.id, 'OWNER')

    const conversation = await store.createConversation({
      businessId: business.id,
      channel: 'whatsapp',
      contactName: 'Cliente Nuevo',
      contactHandle: '5491100000000',
    })

    const spy = vi.spyOn(email, 'sendEmail').mockResolvedValue({ sent: true })
    await notifyNewConversation(business, conversation)

    expect(spy).toHaveBeenCalledTimes(2)
    const recipients = spy.mock.calls.map((c) => c[0].to).sort()
    expect(recipients).toEqual([email1, email2].sort())
    spy.mockRestore()
  })

  it('no le avisa a STAFF, solo a OWNER', async () => {
    const business = await newBusiness()
    const staff = await createUser({ email: uniqueEmail(), password: 'x'.repeat(10), role: 'USER' })
    if (!staff.ok) throw new Error('setup falló')
    await addBusinessMember(staff.id, business.id, 'STAFF')

    const conversation = await store.createConversation({
      businessId: business.id,
      channel: 'whatsapp',
      contactName: 'Cliente Nuevo',
      contactHandle: '5491100000001',
    })

    const spy = vi.spyOn(email, 'sendEmail')
    await notifyNewConversation(business, conversation)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('no explota si un negocio no tiene ningún dueño asignado', async () => {
    const business = await newBusiness()
    const conversation = await store.createConversation({
      businessId: business.id,
      channel: 'whatsapp',
      contactName: 'Cliente Nuevo',
      contactHandle: '5491100000002',
    })
    await expect(notifyNewConversation(business, conversation)).resolves.toBeUndefined()
  })
})

describe('countOpenConversations', () => {
  it('cuenta solo las conversaciones en estado abierta', async () => {
    const business = await newBusiness()
    const c1 = await store.createConversation({
      businessId: business.id, channel: 'whatsapp', contactName: 'A', contactHandle: '1',
    })
    await store.createConversation({
      businessId: business.id, channel: 'whatsapp', contactName: 'B', contactHandle: '2',
    })

    expect(await store.countOpenConversations(business.id)).toBe(2)

    await store.setConversationStatus(c1.id, 'cerrada')
    expect(await store.countOpenConversations(business.id)).toBe(1)
  })
})
