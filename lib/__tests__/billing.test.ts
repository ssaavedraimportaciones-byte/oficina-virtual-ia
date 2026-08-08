import { describe, expect, it } from 'vitest'
import { randomUUID } from 'crypto'
import { prisma } from '../db'
import * as store from '../store'
import { addBusinessMember, createUser } from '../auth'
import { billingConfigured, canOwnAnotherBusiness } from '../billing'

function uniqueEmail(): string {
  return `test-${randomUUID()}@agentsapp.test`
}

async function newUser(): Promise<string> {
  const created = await createUser({ email: uniqueEmail(), password: 'clave-123456', role: 'USER' })
  if (!created.ok) throw new Error(created.reason)
  return created.id
}

describe('billingConfigured', () => {
  it('sin STRIPE_SECRET_KEY, la facturación está desactivada', () => {
    const before = process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_SECRET_KEY
    expect(billingConfigured()).toBe(false)
    if (before) process.env.STRIPE_SECRET_KEY = before
  })
})

describe('límite de negocios por plan', () => {
  it('un admin de plataforma nunca está limitado, tenga el plan que tenga', async () => {
    const admin = await createUser({ email: uniqueEmail(), password: 'x'.repeat(10), role: 'PLATFORM_ADMIN' })
    if (!admin.ok) throw new Error(admin.reason)
    expect(await canOwnAnotherBusiness(admin.id, 'PLATFORM_ADMIN')).toBe(true)
  })

  it('un usuario FREE puede tener un negocio propio, pero no un segundo', async () => {
    const userId = await newUser()
    expect(await canOwnAnotherBusiness(userId, 'USER')).toBe(true)

    const business = await store.createBusiness(
      { agentName: 'A', businessName: 'Negocio único', industry: 'i', description: 'd',
        goals: 'g', tone: 'cercano', channels: ['whatsapp'], configuredAt: '' },
      'manicura',
    )
    await addBusinessMember(userId, business.id, 'OWNER')

    expect(await canOwnAnotherBusiness(userId, 'USER')).toBe(false)
  })

  it('un usuario PRO no tiene límite', async () => {
    const userId = await newUser()
    await prisma.user.update({ where: { id: userId }, data: { plan: 'PRO' } })

    for (let i = 0; i < 3; i++) {
      const business = await store.createBusiness(
        { agentName: 'A', businessName: `Negocio ${i}`, industry: 'i', description: 'd',
          goals: 'g', tone: 'cercano', channels: ['whatsapp'], configuredAt: '' },
        'manicura',
      )
      await addBusinessMember(userId, business.id, 'OWNER')
    }

    expect(await canOwnAnotherBusiness(userId, 'USER')).toBe(true)
  })

  it('ser STAFF (no dueño) de varios negocios no cuenta para el límite', async () => {
    const userId = await newUser()

    for (let i = 0; i < 2; i++) {
      const business = await store.createBusiness(
        { agentName: 'A', businessName: `Staff en ${i}`, industry: 'i', description: 'd',
          goals: 'g', tone: 'cercano', channels: ['whatsapp'], configuredAt: '' },
        'manicura',
      )
      await addBusinessMember(userId, business.id, 'STAFF')
    }

    expect(await canOwnAnotherBusiness(userId, 'USER')).toBe(true)
  })
})
