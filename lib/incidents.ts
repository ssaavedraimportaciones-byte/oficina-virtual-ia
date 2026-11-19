import { prisma } from './db'
import { redactSecrets } from './llmLog'

/**
 * Fallos de integración (WhatsApp, Instagram, IA, pagos) para monitoreo
 * externo (API v1). Sin datos de clientes finales: solo origen, gravedad y un
 * motivo con las claves tapadas. Anotar nunca puede hacer fallar el flujo que
 * está fallando: no lanza.
 */

export type IncidentSource = 'whatsapp' | 'instagram' | 'ia' | 'pagos'
export type IncidentSeverity = 'baja' | 'media' | 'alta' | 'critica'

export const INCIDENT_SOURCES: IncidentSource[] = ['whatsapp', 'instagram', 'ia', 'pagos']
export const INCIDENT_SEVERITIES: IncidentSeverity[] = ['baja', 'media', 'alta', 'critica']

/**
 * Qué tan grave es un error del proveedor de IA: sin clave, sin saldo o con el
 * modelo retirado, el agente deja de responder en TODOS los negocios (crítica);
 * un límite de uso o un corte pasajero se arreglan solos (alta).
 */
export function llmSeverity(status: number | null): IncidentSeverity {
  if (status === 401 || status === 402 || status === 403 || status === 404) return 'critica'
  return 'alta'
}

export async function recordIncident(input: {
  source: IncidentSource
  severity: IncidentSeverity
  code: string
  message: string
  businessId?: string | null
}): Promise<void> {
  try {
    await prisma.incident.create({
      data: {
        source: input.source,
        severity: input.severity,
        code: input.code.slice(0, 60),
        message: redactSecrets(input.message).slice(0, 400),
        businessId: input.businessId ?? null,
      },
    })
    // Poda ocasional: se guardan 180 días.
    if (Math.random() < 0.02) {
      await prisma.incident.deleteMany({ where: { occurredAt: { lt: new Date(Date.now() - 180 * 86_400_000) } } })
    }
  } catch (error) {
    console.error('[incidentes] no se pudo anotar:', error)
  }
}
