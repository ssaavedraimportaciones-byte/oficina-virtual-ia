import Stripe from 'stripe'
import { prisma } from './db'
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

/** En el plan FREE alcanza con un negocio propio; PRO no tiene límite. */
const FREE_BUSINESS_LIMIT = 1

/** Los admins de plataforma no están sujetos a ningún límite de plan. */
export async function canOwnAnotherBusiness(userId: string, role: SystemRole): Promise<boolean> {
  if (role === 'PLATFORM_ADMIN') return true

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (user.plan === 'PRO') return true

  const owned = await prisma.businessMember.count({ where: { userId, role: 'OWNER' } })
  return owned < FREE_BUSINESS_LIMIT
}

export type BillingLinkResult = { ok: true; url: string } | { ok: false; reason: string }

/** Sesión de checkout de Stripe para pasar a PRO. Crea el customer en Stripe la primera vez. */
export async function createUpgradeCheckout(
  user: { id: string; email: string; stripeCustomerId: string | null },
  successUrl: string,
  cancelUrl: string,
): Promise<BillingLinkResult> {
  const stripe = getStripe()
  if (!stripe) return { ok: false, reason: 'La facturación no está configurada todavía.' }

  const priceId = process.env.STRIPE_PRICE_ID_PRO
  if (!priceId) return { ok: false, reason: 'Falta configurar el plan PRO (STRIPE_PRICE_ID_PRO).' }

  let customerId = user.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } })
    customerId = customer.id
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: user.id,
  })

  if (!session.url) return { ok: false, reason: 'Stripe no devolvió una URL de checkout.' }
  return { ok: true, url: session.url }
}

/** Portal de Stripe para que el usuario gestione o cancele su propia suscripción. */
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
 * Único lugar donde el plan de un usuario pasa a PRO o vuelve a FREE: nunca
 * se confía en lo que devuelve el navegador después del checkout, solo en
 * este webhook firmado por Stripe.
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
      if (userId) {
        await prisma.user
          .update({ where: { id: userId }, data: { plan: 'PRO', stripeSubscriptionId: subscriptionId } })
          .catch(() => {})
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
      await prisma.user.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { plan: active ? 'PRO' : 'FREE' },
      })
      break
    }
    default:
      break
  }

  return { ok: true }
}
