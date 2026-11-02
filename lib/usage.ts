import { prisma } from './db'
import { comparePlans, type PlanName } from './plans'
import { monthlyLimit } from './planLimits'

/**
 * Cupo mensual de respuestas del agente por empresa.
 *
 * Todas las empresas comparten la clave de IA de la plataforma, así que cada
 * respuesta le cuesta plata al dueño de la plataforma, no a quien la pide. Sin
 * un tope, una empresa del plan gratis (o un bucle, o alguien abusando del
 * simulador) puede gastar el saldo de todos.
 *
 * El tope sale del plan del DUEÑO de la empresa y se configura por entorno,
 * una variable por plan (AGENT_REPLIES_FREE, AGENT_REPLIES_BASICO,
 * AGENT_REPLIES_NEGOCIOS, AGENT_REPLIES_ILIMITADO). Un valor negativo
 * significa "sin límite".
 */

export type { PlanName }

export { monthlyLimit } from './planLimits'

/**
 * Plan de una empresa = el mejor plan entre sus dueños. Una empresa sin dueños
 * (la crea y administra el equipo de la plataforma, p. ej. para un cliente de
 * agencia) usa el cupo PRO: ahí el control de costos lo lleva el administrador.
 */
export async function businessPlan(businessId: string): Promise<PlanName> {
  const owners = await prisma.businessMember.findMany({
    where: { businessId, role: 'OWNER' },
    select: { user: { select: { plan: true } } },
  })
  if (owners.length === 0) return 'ILIMITADO'
  return owners.reduce<PlanName>(
    (best, o) => (comparePlans(o.user.plan, best) > 0 ? o.user.plan : best),
    'FREE',
  )
}

/** Inicio del mes en curso (UTC): el cupo se renueva el día 1. */
export function startOfMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export interface AgentUsage {
  plan: PlanName
  used: number
  /** `null` = sin límite. */
  limit: number | null
  exceeded: boolean
  /** Mes al que corresponde, "YYYY-MM": sirve de clave para avisar una vez por mes. */
  month: string
}

export async function getAgentUsage(businessId: string, now: Date = new Date()): Promise<AgentUsage> {
  const [plan, override, used] = await Promise.all([
    businessPlan(businessId),
    // Límite fijado a mano por el dueño de la plataforma para esta empresa.
    prisma.business.findUnique({ where: { id: businessId }, select: { replyLimitOverride: true } }),
    // Cuenta toda respuesta del agente, también las del simulador del panel:
    // las dos llaman a la IA y cuestan lo mismo.
    prisma.message.count({
      where: {
        sender: 'agent',
        timestamp: { gte: startOfMonth(now) },
        conversation: { businessId },
      },
    }),
  ])
  const limit = override?.replyLimitOverride ?? monthlyLimit(plan)
  return {
    plan,
    used,
    limit,
    exceeded: limit !== null && used >= limit,
    month: now.toISOString().slice(0, 7),
  }
}

/** Lo que se le manda al cliente final cuando el cupo se agotó, sin llamar a la IA. */
export const QUOTA_REPLY =
  'Gracias por escribirnos. En este momento no podemos responder de forma automática, pero una persona del equipo te va a contestar lo antes posible.'

/** Lo que ve quien prueba el simulador desde el panel. */
export function quotaMessage(usage: AgentUsage): string {
  const upgrade = usage.plan === 'FREE' ? ' Pásate a un plan pago para aumentar el límite.' : ''
  const unit = usage.limit === 1 ? 'respuesta automática' : 'respuestas automáticas'
  return `Llegaste al límite de ${usage.limit} ${unit} de este mes.${upgrade}`
}
