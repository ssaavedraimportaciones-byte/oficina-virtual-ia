import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { prisma } from '../db'
import { addBusinessMember, createUser } from '../auth'
import * as store from '../store'
import { BUSINESS_LIMIT, comparePlans, isPaidPlan, PAID_PLANS } from '../plans'

/**
 * `lib/billing.ts` habla con la API de Stripe de verdad, así que para probar
 * su lógica sin red se reemplaza el SDK por un doble: lo que importa acá no
 * es que Stripe funcione (eso lo prueba Stripe), sino que el sistema arme la
 * sesión correcta y que el webhook mueva el plan correcto.
 */
const sessionsCreate = vi.fn()
const customersCreate = vi.fn()
const constructEvent = vi.fn()

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    customers: { create: customersCreate },
    checkout: { sessions: { create: sessionsCreate } },
    webhooks: { constructEvent },
  })),
}))

const ORIGINAL = { ...process.env }

beforeEach(() => {
  process.env = {
    ...ORIGINAL,
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x',
    STRIPE_PRICE_ID_BASICO: 'price_basico',
    STRIPE_PRICE_ID_NEGOCIOS: 'price_negocios',
    STRIPE_PRICE_ID_ILIMITADO: 'price_ilimitado',
    STRIPE_PRICE_ID_SETUP: 'price_setup',
  }
  sessionsCreate.mockReset().mockResolvedValue({ url: 'https://checkout.stripe.test/x' })
  customersCreate.mockReset().mockResolvedValue({ id: 'cus_nuevo' })
  constructEvent.mockReset()
  vi.resetModules()
})

afterEach(() => {
  process.env = { ...ORIGINAL }
})

async function newUser(): Promise<string> {
  const created = await createUser({ email: `plan-${randomUUID()}@agentsapp.test`, password: 'clave-123456', role: 'USER' })
  if (!created.ok) throw new Error(created.reason)
  return created.id
}

/** Un negocio de este usuario, con o sin la implementación ya pagada. */
async function newBusiness(userId: string, setupFeePaidAt: Date | null = null): Promise<string> {
  const business = await store.createBusiness(
    { agentName: 'A', businessName: `Negocio ${randomUUID()}`, industry: 'i', description: 'd',
      goals: 'g', tone: 'cercano', channels: ['whatsapp'], configuredAt: '' },
    'manicura',
  )
  await addBusinessMember(userId, business.id, 'OWNER')
  if (setupFeePaidAt) await prisma.business.update({ where: { id: business.id }, data: { setupFeePaidAt } })
  return business.id
}

describe('lib/plans: reglas de cada plan', () => {
  it('ordena los planes de menor a mayor', () => {
    expect(comparePlans('ILIMITADO', 'FREE')).toBeGreaterThan(0)
    expect(comparePlans('NEGOCIOS', 'BASICO')).toBeGreaterThan(0)
    expect(comparePlans('BASICO', 'BASICO')).toBe(0)
  })

  it('el límite de negocios de cada plan es el que vendemos', () => {
    expect(BUSINESS_LIMIT.FREE).toBe(1)
    expect(BUSINESS_LIMIT.BASICO).toBe(1)
    expect(BUSINESS_LIMIT.NEGOCIOS).toBe(3)
    expect(BUSINESS_LIMIT.ILIMITADO).toBeNull()
  })

  it('isPaidPlan distingue los 3 planes pagos de FREE y de cualquier otro texto', () => {
    for (const plan of PAID_PLANS) expect(isPaidPlan(plan)).toBe(true)
    expect(isPaidPlan('FREE')).toBe(false)
    expect(isPaidPlan('pro')).toBe(false)
    expect(isPaidPlan('')).toBe(false)
  })
})

describe('createUpgradeCheckout: la implementación se cobra por negocio', () => {
  it('con un negocio sin pagar, cobra una implementación además del plan', async () => {
    const { createUpgradeCheckout } = await import('../billing')
    const userId = await newUser()
    const businessId = await newBusiness(userId)
    const result = await createUpgradeCheckout(
      { id: userId, email: 'a@b.test', stripeCustomerId: null },
      [businessId],
      'NEGOCIOS',
      'https://x/ok',
      'https://x/cancel',
    )
    expect(result.ok).toBe(true)
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          { price: 'price_negocios', quantity: 1 },
          { price: 'price_setup', quantity: 1 },
        ],
        metadata: { plan: 'NEGOCIOS', setupFeeBusinessIds: businessId },
      }),
    )
  })

  it('con 2 negocios sin pagar, cobra la implementación 2 veces (cantidad 2)', async () => {
    const { createUpgradeCheckout } = await import('../billing')
    const userId = await newUser()
    const a = await newBusiness(userId)
    const b = await newBusiness(userId)
    const result = await createUpgradeCheckout(
      { id: userId, email: 'a@b.test', stripeCustomerId: 'cus_1' },
      [a, b],
      'NEGOCIOS',
      'https://x/ok',
      'https://x/cancel',
    )
    expect(result.ok).toBe(true)
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          { price: 'price_negocios', quantity: 1 },
          { price: 'price_setup', quantity: 2 },
        ],
        metadata: { plan: 'NEGOCIOS', setupFeeBusinessIds: `${a},${b}` },
      }),
    )
  })

  it('si todos sus negocios ya pagaron la implementación, el checkout no la vuelve a cobrar', async () => {
    const { createUpgradeCheckout } = await import('../billing')
    const userId = await newUser()
    const result = await createUpgradeCheckout(
      { id: userId, email: 'a@b.test', stripeCustomerId: 'cus_1' },
      [],
      'BASICO',
      'https://x/ok',
      'https://x/cancel',
    )
    expect(result.ok).toBe(true)
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_basico', quantity: 1 }],
        metadata: { plan: 'BASICO', setupFeeBusinessIds: '' },
      }),
    )
  })

  it('sin el Price de ese plan configurado, avisa en vez de armar una sesión rota', async () => {
    delete process.env.STRIPE_PRICE_ID_ILIMITADO
    const { createUpgradeCheckout } = await import('../billing')
    const userId = await newUser()
    const result = await createUpgradeCheckout(
      { id: userId, email: 'a@b.test', stripeCustomerId: 'cus_1' },
      [],
      'ILIMITADO',
      'https://x/ok',
      'https://x/cancel',
    )
    expect(result).toEqual({ ok: false, reason: 'Falta configurar el plan ILIMITADO (STRIPE_PRICE_ID_ILIMITADO).' })
    expect(sessionsCreate).not.toHaveBeenCalled()
  })
})

describe('el webhook de Stripe mueve el plan y marca pagados los negocios correctos', () => {
  it('al completar el checkout, deja el plan del usuario y la implementación pagada de sus negocios', async () => {
    const { handleStripeWebhook } = await import('../billing')
    const userId = await newUser()
    const paid = await newBusiness(userId) // ya la tenía pagada, no debería tocarse
    const oldPaidAt = (await prisma.business.update({ where: { id: paid }, data: { setupFeePaidAt: new Date('2020-01-01') } })).setupFeePaidAt
    const a = await newBusiness(userId)
    const b = await newBusiness(userId)
    const otherUsersBusiness = await newBusiness(await newUser()) // no es suyo: no se le toca aunque esté en el metadata

    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          client_reference_id: userId,
          subscription: 'sub_abc',
          metadata: { plan: 'NEGOCIOS', setupFeeBusinessIds: `${a},${b},${otherUsersBusiness}` },
        },
      },
    })

    const result = await handleStripeWebhook('{}', 'firma')
    expect(result).toEqual({ ok: true })

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(user.plan).toBe('NEGOCIOS')
    expect(user.stripeSubscriptionId).toBe('sub_abc')

    expect((await prisma.business.findUniqueOrThrow({ where: { id: a } })).setupFeePaidAt).not.toBeNull()
    expect((await prisma.business.findUniqueOrThrow({ where: { id: b } })).setupFeePaidAt).not.toBeNull()
    // El que ya estaba pagado conserva su fecha, no se pisa con "ahora"
    expect((await prisma.business.findUniqueOrThrow({ where: { id: paid } })).setupFeePaidAt).toEqual(oldPaidAt)
    // El negocio de otro usuario, aunque vino en el metadata, no se toca
    expect((await prisma.business.findUniqueOrThrow({ where: { id: otherUsersBusiness } })).setupFeePaidAt).toBeNull()
  })

  it('un cambio de plan desde el portal (otro price) actualiza el plan sin tocar la implementación', async () => {
    const { handleStripeWebhook } = await import('../billing')
    const userId = await newUser()
    await prisma.user.update({
      where: { id: userId },
      data: { plan: 'BASICO', stripeSubscriptionId: 'sub_xyz' },
    })

    constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_xyz',
          status: 'active',
          items: { data: [{ price: { id: 'price_ilimitado' } }] },
        },
      },
    })
    await handleStripeWebhook('{}', 'firma')

    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe('ILIMITADO')
  })

  it('cancelar la suscripción baja al plan gratis', async () => {
    const { handleStripeWebhook } = await import('../billing')
    const userId = await newUser()
    await prisma.user.update({
      where: { id: userId },
      data: { plan: 'ILIMITADO', stripeSubscriptionId: 'sub_del' },
    })

    constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_del' } },
    })
    await handleStripeWebhook('{}', 'firma')

    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(row.plan).toBe('FREE')
    expect(row.stripeSubscriptionId).toBeNull()
  })
})
