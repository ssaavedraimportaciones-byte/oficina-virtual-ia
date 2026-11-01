import type { Plan } from './generated/prisma/enums'

/**
 * Los planes pagos, en un solo lugar: cuántos negocios incluye cada uno, en
 * qué orden (para "el mejor plan entre los dueños"), y qué variable de
 * entorno trae su precio de Stripe. `lib/billing.ts` (cobro) y `lib/usage.ts`
 * (cupo de respuestas) leen de acá para no definir los mismos tramos dos veces.
 *
 * FREE es la prueba gratis: 1 negocio, sin pago. Los tres planes pagos se
 * diferencian por cuántos negocios puede tener el cliente, no por cupo de
 * mensajes (ese cupo también escala, pero es secundario a la razón de pagar
 * más: manejar más de un negocio).
 */
export type PlanName = Plan

export const PLAN_ORDER = ['FREE', 'BASICO', 'NEGOCIOS', 'ILIMITADO'] as const satisfies readonly PlanName[]

/** Los tres planes que se pagan en Stripe, de menor a mayor. FREE no se cobra. */
export const PAID_PLANS = ['BASICO', 'NEGOCIOS', 'ILIMITADO'] as const satisfies readonly PlanName[]
export type PaidPlan = (typeof PAID_PLANS)[number]

const RANK: Record<PlanName, number> = Object.fromEntries(PLAN_ORDER.map((p, i) => [p, i])) as Record<
  PlanName,
  number
>

/** Compara dos planes: positivo si `a` es mejor que `b`. Para "el mejor plan entre los dueños". */
export function comparePlans(a: PlanName, b: PlanName): number {
  return RANK[a] - RANK[b]
}

/** Negocios propios que permite cada plan. `null` = sin límite. */
export const BUSINESS_LIMIT: Record<PlanName, number | null> = {
  FREE: 1,
  BASICO: 1,
  NEGOCIOS: 3,
  ILIMITADO: null,
}

export const PLAN_LABEL: Record<PlanName, string> = {
  FREE: 'Prueba gratis',
  BASICO: 'Básico',
  NEGOCIOS: 'Negocios',
  ILIMITADO: 'Ilimitado',
}

/**
 * Precio de referencia en CLP/mes, solo para mostrarlo en la pantalla de
 * precios: el cobro real lo define el Price de Stripe (`PLAN_PRICE_ENV`),
 * así que un desajuste acá no cambia cuánto se le cobra a nadie.
 */
export const PLAN_MONTHLY_CLP: Record<PaidPlan, number> = {
  BASICO: 25_000,
  NEGOCIOS: 55_000,
  ILIMITADO: 90_000,
}

/** Pago único de implementación, informativo (el monto real lo trae `STRIPE_PRICE_ID_SETUP`). */
export const SETUP_FEE_CLP = 90_000

/** Variable de entorno que trae el Price de Stripe de cada plan pago. */
export const PLAN_PRICE_ENV: Record<PaidPlan, string> = {
  BASICO: 'STRIPE_PRICE_ID_BASICO',
  NEGOCIOS: 'STRIPE_PRICE_ID_NEGOCIOS',
  ILIMITADO: 'STRIPE_PRICE_ID_ILIMITADO',
}

/** Acepta cualquier string para poder validar datos externos (Stripe) sin un cast previo. */
export function isPaidPlan(plan: string): plan is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(plan)
}
