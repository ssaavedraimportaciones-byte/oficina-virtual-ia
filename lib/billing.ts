import Stripe from 'stripe'
import { prisma } from './db'
import { BUSINESS_LIMIT, PAID_PLANS, PLAN_PRICE_ENV, isPaidPlan, type PaidPlan, type PlanName } from './plans'
import type { SystemRole } from './generated/prisma/enums'

/**
 * Igual patrón que lib/email.ts: si no está configurado (sin
 * STRIPE_SECRET_KEY), todo lo relacionado a pagos se degrada con un error
 * claro en vez de explotar — el resto de la app (plan FREE) sigue andando.
 */
export function billingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

let stripeClient: Stripe | null | undefined

function getStripe(): Stripe | null {
  if (stripeClient !== undefined) return stripeClient
  if (!billingConfigured()) {
    stripeClient = null
    return stripeClient
  }
  stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  return stripeClient
}

/** Los admins de plataforma no están sujetos a ningún límite de plan. */
export async function canOwnAnotherBusiness(userId: string, role: SystemRole): Promise<boolean> {
  if (role === 'PLATFORM_ADMIN') return true

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const limit = BUSINESS_LIMIT[user.plan]
  if (limit === null) return true

  const owned = await prisma.businessMember.count({ where: { userId, role: 'OWNER' } })
  return owned < limit
}

/** El Price de Stripe de cada plan pago, solo los que están configurados. */
function priceIdFor(plan: PaidPlan): string | null {
  return process.env[PLAN_PRICE_ENV[plan]] ?? null
}

/** priceId de Stripe -> plan, para leer de vuelta qué plan trae una suscripción. */
function planForPriceId(priceId: string | null | undefined): PlanName | null {
  if (!priceId) return null
  for (const plan of PAID_PLANS) {
    if (priceIdFor(plan) === priceId) return plan
  }
  return null
}

export type BillingLinkResult = { ok: true; url: string } | { ok: false; reason: string }

/** Máximo de negocios que se pueden cobrar de implementación en un mismo checkout (ver nota de metadata abajo). */
const MAX_SETUP_FEE_BUSINESSES = 10

/**
 * Sesión de checkout de Stripe para pasar a un plan pago. Se cobra la
 * implementación una vez por cada negocio del cliente que todavía no la tenga
 * pagada (Stripe acepta ítems de una sola vez junto con la suscripción, con
 * cantidad): si es su primer negocio paga una implementación, si tiene 2 sin
 * pagar paga dos. Un negocio que ya la pagó no se vuelve a cobrar.
 */
export async function createUpgradeCheckout(
  user: { id: string; email: string; stripeCustomerId: string | null },
  unbilledBusinessIds: string[],
  plan: PaidPlan,
  successUrl: string,
  cancelUrl: string,
): Promise<BillingLinkResult> {
  const stripe = getStripe()
  if (!stripe) return { ok: false, reason: 'La facturación no está configurada todavía.' }

  const priceId = priceIdFor(plan)
  if (!priceId) return { ok: false, reason: `Falta configurar el plan ${plan} (${PLAN_PRICE_ENV[plan]}).` }

  const setupPriceId = process.env.STRIPE_PRICE_ID_SETUP
  if (unbilledBusinessIds.length > 0 && !setupPriceId) {
    return { ok: false, reason: 'Falta configurar el cobro de implementación (STRIPE_PRICE_ID_SETUP).' }
  }
  // El metadata de Stripe tiene 500 caracteres por valor: con más negocios no
  // entrarían todos los ids. No pasa en la práctica (el plan con más negocios
  // tiene 3), pero se corta la lista antes que mandar algo que el webhook no
  // pueda leer entero.
  const toBill = unbilledBusinessIds.slice(0, MAX_SETUP_FEE_BUSINESSES)

  let customerId = user.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } })
    customerId = customer.id
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      { price: priceId, quantity: 1 },
      ...(toBill.length > 0 && setupPriceId ? [{ price: setupPriceId, quantity: toBill.length }] : []),
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: user.id,
    // El webhook decide con esto, no adivinando de los line items: qué plan
    // quedó y a qué negocios marcarles la implementación como pagada.
    metadata: { plan, setupFeeBusinessIds: toBill.join(',') },
  })

  if (!session.url) return { ok: false, reason: 'Stripe no devolvió una URL de checkout.' }
  return { ok: true, url: session.url }
}

/** Portal de Stripe para que el usuario gestione, cambie o cancele su propia suscripción. */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<BillingLinkResult> {
  const stripe = getStripe()
  if (!stripe) return { ok: false, reason: 'La facturación no está configurada todavía.' }

  const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl })
  return { ok: true, url: session.url }
}

export type WebhookResult = { ok: true } | { ok: false; status: number; reason: string }

/**
 * Único lugar donde el plan de un usuario cambia: nunca se confía en lo que
 * devuelve el navegador después del checkout, solo en este webhook firmado
 * por Stripe.
 */
export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
): Promise<WebhookResult> {
  const stripe = getStripe()
  if (!stripe) return { ok: false, status: 503, reason: 'Facturación no configurada.' }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) return { ok: false, status: 503, reason: 'Falta STRIPE_WEBHOOK_SECRET.' }
  if (!signature) return { ok: false, status: 400, reason: 'Falta la firma.' }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch {
    return { ok: false, status: 400, reason: 'Firma inválida.' }
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.client_reference_id
      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : (session.subscription?.id ?? null)
      const plan = session.metadata?.plan
      if (userId && plan && isPaidPlan(plan)) {
        await prisma.user
          .update({ where: { id: userId }, data: { plan, stripeSubscriptionId: subscriptionId } })
          .catch(() => {})

        const businessIds = (session.metadata?.setupFeeBusinessIds ?? '').split(',').filter(Boolean)
        if (businessIds.length > 0) {
          // Solo negocios de ESTE usuario: el metadata lo arma el servidor en
          // createUpgradeCheckout, pero igual se revalida antes de marcar nada
          // como pagado.
          await prisma.business.updateMany({
            where: { id: { in: businessIds }, members: { some: { userId, role: 'OWNER' } } },
            data: { setupFeePaidAt: new Date() },
          })
        }
      }
      break
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      await prisma.user.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { plan: 'FREE', stripeSubscriptionId: null },
      })
      break
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const active = subscription.status === 'active' || subscription.status === 'trialing'
      // El cliente puede cambiar de plan desde el portal de Stripe: ahí
      // cambia el price del ítem, no el metadata del checkout original.
      const plan = active ? planForPriceId(subscription.items.data[0]?.price.id) : 'FREE'
      if (plan) {
        await prisma.user.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: { plan },
        })
      }
      break
    }
    default:
      break
  }

  return { ok: true }
}
