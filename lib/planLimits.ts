import type { PlanName } from './plans'

/**
 * Cupo mensual de respuestas por plan. Vive aparte de lib/usage.ts para que la
 * landing pueda mostrar los cupos reales sin arrastrar la conexión a la base.
 * Se puede ajustar por variable de entorno (AGENT_REPLIES_FREE, ...); un valor
 * negativo significa "sin límite".
 */
const DEFAULT_LIMITS: Record<PlanName, number> = { FREE: 300, BASICO: 1500, NEGOCIOS: 4000, ILIMITADO: 10_000 }
const ENV_VARS: Record<PlanName, string> = {
  FREE: 'AGENT_REPLIES_FREE',
  BASICO: 'AGENT_REPLIES_BASICO',
  NEGOCIOS: 'AGENT_REPLIES_NEGOCIOS',
  ILIMITADO: 'AGENT_REPLIES_ILIMITADO',
}

/** Respuestas por mes que incluye el plan. `null` = sin límite. */
export function monthlyLimit(plan: PlanName): number | null {
  const raw = process.env[ENV_VARS[plan]]
  const parsed = raw === undefined || raw === '' ? NaN : Number(raw)
  const value = Number.isFinite(parsed) ? Math.trunc(parsed) : DEFAULT_LIMITS[plan]
  return value < 0 ? null : value
}
