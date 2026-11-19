import type Stripe from 'stripe'
import { prisma } from './db'
import { recordIncident } from './incidents'
import { PAID_PLANS, PLAN_MONTHLY_CLP, PLAN_PRICE_ENV, isPaidPlan } from './plans'

/**
 * Registro propio de suscripciones, pagos y facturas, alimentado SOLO por los
 * avisos firmados de Stripe (ver handleStripeWebhook). Es lo que lee la API v1
 * de solo lectura: así los sistemas externos no necesitan hablar con Stripe ni
 * ver más de lo que corresponde. Los montos de Stripe en CLP ya vienen en
 * pesos enteros (CLP no tiene decimales).
 */

const fromUnix = (s: number | null | undefined) => (typeof s === 'number' ? new Date(s * 1000) : null)

function customerId(c: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined): string | null {
  if (!c) return null
  return typeof c === 'string' ? c : c.id
}

async function userIdForCustomer(customer: string | null): Promise<string | null> {
  if (!customer) return null
  const user = await prisma.user.findFirst({ where: { stripeCustomerId: customer }, select: { id: true } })
  return user?.id ?? null
}

function planForPrice(priceId: string | null | undefined): string | null {
  if (!priceId) return null
  return PAID_PLANS.find((p) => process.env[PLAN_PRICE_ENV[p]] === priceId) ?? null
}

/** Guarda o actualiza la suscripción de un usuario según lo que dice Stripe. */
export async function syncSubscription(sub: Stripe.Subscription, now = new Date()): Promise<void> {
  const userId = (await userIdForCustomer(customerId(sub.customer))) ?? sub.metadata?.userId ?? null
  if (!userId) return
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
  if (!user) return

  const item = sub.items.data[0]
  const plan = planForPrice(item?.price.id) ?? (isPaidPlan(user.plan) ? user.plan : 'BASICO')
  const amountClp = sub.items.data.reduce((sum, i) => sum + (i.price.unit_amount ?? 0) * (i.quantity ?? 1), 0) || PLAN_MONTHLY_CLP[plan as keyof typeof PLAN_MONTHLY_CLP] || 0
  // La fecha de fin de período se movió de la suscripción al ítem en versiones nuevas de la API.
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end ?? (item as unknown as { current_period_end?: number } | undefined)?.current_period_end

  const existing = await prisma.subscription.findUnique({ where: { id: sub.id } })
  const unpaid = sub.status === 'past_due' || sub.status === 'unpaid'
  const pastDueSince = unpaid ? (existing?.pastDueSince ?? now) : null

  const data = {
    userId,
    plan,
    status: sub.status,
    amountClp,
    currentPeriodEnd: fromUnix(periodEnd),
    canceledAt: fromUnix(sub.canceled_at),
    pastDueSince,
  }
  await prisma.subscription.upsert({ where: { id: sub.id }, create: { id: sub.id, ...data }, update: data })
}

/** Mapea el estado de una factura de Stripe al vocabulario de la API. */
export function invoiceStatus(inv: Pick<Stripe.Invoice, 'status' | 'due_date'>, now = new Date()): 'pagada' | 'pendiente' | 'vencida' | 'anulada' {
  if (inv.status === 'paid') return 'pagada'
  if (inv.status === 'void' || inv.status === 'uncollectible') return 'anulada'
  const due = fromUnix(inv.due_date)
  return due && due < now ? 'vencida' : 'pendiente'
}

/** Guarda la factura y, si está pagada, el pago. Idempotente: Stripe reenvía avisos. */
export async function recordInvoice(inv: Stripe.Invoice, now = new Date()): Promise<void> {
  if (!inv.id || inv.status === 'draft') return
  const userId = await userIdForCustomer(customerId(inv.customer))
  const status = invoiceStatus(inv, now)
  const paidAt = status === 'pagada' ? (fromUnix(inv.status_transitions?.paid_at) ?? now) : null
  const issuedAt = fromUnix(inv.created) ?? now

  const data = {
    userId,
    number: inv.number ?? null,
    amountClp: inv.total ?? inv.amount_due ?? 0,
    status,
    issuedAt,
    dueDate: fromUnix(inv.due_date),
    paidAt,
  }
  await prisma.invoice.upsert({ where: { stripeInvoiceId: inv.id }, create: { stripeInvoiceId: inv.id, ...data }, update: data })

  if (status === 'pagada' && (inv.amount_paid ?? 0) > 0) {
    await prisma.payment.upsert({
      where: { stripeInvoiceId: inv.id },
      create: { stripeInvoiceId: inv.id, userId, amountClp: inv.amount_paid, method: 'stripe', status: 'pagado', paidAt: paidAt! },
      update: { userId, amountClp: inv.amount_paid, paidAt: paidAt! },
    })
  }
}

/** Un cobro falló: queda como incidente y la suscripción pasa a contar los días de atraso. */
export async function recordPaymentFailed(inv: Stripe.Invoice, now = new Date()): Promise<void> {
  await recordInvoice(inv, now)
  const subId = (inv as unknown as { subscription?: string | { id: string } | null }).subscription
  const id = typeof subId === 'string' ? subId : subId?.id
  if (id) {
    await prisma.subscription.updateMany({ where: { id, pastDueSince: null }, data: { pastDueSince: now } })
  }
  await recordIncident({
    source: 'pagos',
    severity: 'alta',
    code: 'cobro_fallido',
    message: `Falló el cobro de una factura de $${(inv.amount_due ?? 0).toLocaleString('es-CL')}.`,
  })
}
