import type { Plan, SetupTier } from './generated/prisma/enums'

export type { SetupTier }

/**
 * Los planes pagos, en un solo lugar: cuántos negocios incluye cada uno, en
 * qué orden (para "el mejor plan entre los dueños"), y qué variable de
 * entorno trae su precio de Stripe. `lib/billing.ts` (cobro) y `lib/usage.ts`
 * (cupo de respuestas) leen de acá para no definir los mismos tramos dos veces.
 *
 * FREE es la cuenta sin plan contratado: 1 negocio, sin pago. No se ofrece como
 * plan: el modelo comercial es implementación más mensualidad. Los tres planes pagos se
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
  FREE: 'Sin plan contratado',
  BASICO: 'Básico',
  NEGOCIOS: 'Negocios',
  ILIMITADO: 'Ilimitado',
}

/**
 * Precio de referencia en CLP/mes, solo para mostrarlo en la pantalla de
 * precios: el cobro real lo define el Price de Stripe (`PLAN_PRICE_ENV`),
 * así que un desajuste acá no cambia cuánto se le cobra a nadie.
 *
 * A la altura de lo que el agente hace de verdad (no es un árbol de botones):
 * entiende lenguaje natural, agenda horas y reservas de mesa con croquis,
 * toma pedidos con catálogo y stock, escucha notas de voz, deriva a una
 * persona cuando corresponde, y atiende WhatsApp e Instagram del mismo panel.
 * Sigue por debajo de la competencia con WhatsApp (Whaticket, Callbell,
 * Landbot rondan $47.000–$170.000 CLP/mes y son bots de opciones, no IA).
 */
export const PLAN_MONTHLY_CLP: Record<PaidPlan, number> = {
  BASICO: 45_000,
  NEGOCIOS: 95_000,
  ILIMITADO: 160_000,
}

/**
 * Pago único de implementación del PRIMER local, informativo (los montos
 * reales los traen `STRIPE_PRICE_ID_SETUP_*`). Varía según qué se activa: no
 * es lo mismo dejar un solo canal sin cobros que un local con mesas,
 * pedidos, cobros y varios canales. Lo fija el administrador por negocio
 * (`Business.setupTier`) según este criterio. Referencia de mercado en Chile
 * (2026): implementaciones de agentes con IA para pymes desde $300.000, así
 * que incluso el nivel Avanzado queda por debajo.
 */
export const SETUP_FEE_BY_TIER: Record<SetupTier, number> = {
  SIMPLE: 150_000,
  ESTANDAR: 190_000,
  AVANZADO: 250_000,
}

export const SETUP_TIER_ORDER = ['SIMPLE', 'ESTANDAR', 'AVANZADO'] as const satisfies readonly SetupTier[]

export const SETUP_TIER_LABEL: Record<SetupTier, string> = {
  SIMPLE: 'Simple',
  ESTANDAR: 'Estándar',
  AVANZADO: 'Avanzado',
}

/** Qué incluye cada nivel, en palabras del dueño del negocio (sin "canales" ni "integraciones"). */
export const SETUP_TIER_DESC: Record<SetupTier, string> = {
  SIMPLE: 'Responde, agenda horas o toma pedidos por WhatsApp. Sin cobrar por el chat.',
  ESTANDAR: 'Lo anterior, y además cobra por el chat (transferencia o Mercado Pago) y avisa a la cocina o cuando se acaba el stock.',
  AVANZADO: 'Restaurante completo: reservas de mesa en el plano del local, pedidos, cobros, y WhatsApp e Instagram juntos.',
}

/** Negocios típicos de cada nivel, para que el cliente se ubique solo. */
export const SETUP_TIER_EXAMPLE: Record<SetupTier, string> = {
  SIMPLE: 'Peluquería, uñas, taller, consulta',
  ESTANDAR: 'Food truck, tienda, pastelería, delivery',
  AVANZADO: 'Restaurante con salón y terraza',
}

/** Compatibilidad: el nivel Estándar es el de referencia histórico. */
export const SETUP_FEE_CLP = SETUP_FEE_BY_TIER.ESTANDAR
/** Cada local adicional del mismo cliente, sin importar el nivel de su primer local. */
export const SETUP_FEE_EXTRA_CLP = 90_000

/**
 * Total de implementación por `locales` locales nuevos: el primero paga
 * según su nivel (`firstTier`); del segundo en adelante, el precio plano de
 * local adicional. Si ya pagó el primero (`firstAlreadyPaid`), todos los
 * nuevos van a precio de adicional.
 */
export function setupFeeTotal(locales: number, firstAlreadyPaid = false, firstTier: SetupTier = 'ESTANDAR'): number {
  if (locales <= 0) return 0
  return firstAlreadyPaid
    ? locales * SETUP_FEE_EXTRA_CLP
    : SETUP_FEE_BY_TIER[firstTier] + (locales - 1) * SETUP_FEE_EXTRA_CLP
}

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
