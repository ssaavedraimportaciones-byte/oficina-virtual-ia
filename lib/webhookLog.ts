import { prisma } from './db'

/**
 * Bitácora de los avisos que Meta manda al webhook de WhatsApp.
 *
 * Cuando un mensaje "no responde" hay tres lugares donde se puede haber
 * perdido: Meta nunca lo mandó, llegó y se rechazó (firma, secreto), o llegó
 * y no se encontró el negocio. Los registros de Vercel distinguen eso solo si
 * el código escribe algo, y hasta ahora el camino feliz (y el de "negocio no
 * encontrado") no escribía nada. Esto deja la huella en la base, donde el
 * dueño de la plataforma y quien depure pueden leerla sin entrar a Vercel.
 *
 * No guarda nada de los clientes finales: ni teléfonos ni texto de mensajes.
 * Solo el número de la EMPRESA (phone_number_id), conteos y el resultado.
 *
 * Vive como JSON en `platform_settings`, igual que las altas: son pocas
 * filas de uso interno y no vale una migración.
 */

const KEY = 'webhook_log'
const MAX_ENTRIES = 30

export interface WebhookChangeOutcome {
  field: string
  /** El número de WhatsApp de la empresa al que le escribieron. */
  phoneNumberId: string | null
  /** ¿Algún negocio de la plataforma tiene ese número cargado? */
  matched: boolean
  messages: number
  statuses: number
  /** Tipos de mensaje (text, image, ...), sin contenido. */
  types: string[]
}

export interface WebhookLogEntry {
  at: string
  /** `ok`, o el motivo por el que se rechazó el pedido. */
  result: string
  changes: WebhookChangeOutcome[]
}

export async function listWebhookLog(): Promise<WebhookLogEntry[]> {
  const row = await prisma.platformSetting.findUnique({ where: { key: KEY } })
  if (!row) return []
  try {
    const parsed = JSON.parse(row.value)
    return Array.isArray(parsed) ? (parsed as WebhookLogEntry[]) : []
  } catch {
    // Un JSON roto no puede tumbar el webhook: se empieza de cero.
    return []
  }
}

/** Nunca lanza: anotar no puede hacer fallar la respuesta a Meta. */
export async function recordWebhook(result: string, changes: WebhookChangeOutcome[] = []): Promise<void> {
  try {
    const entries = [{ at: new Date().toISOString(), result, changes }, ...(await listWebhookLog())].slice(
      0,
      MAX_ENTRIES,
    )
    const value = JSON.stringify(entries)
    await prisma.platformSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, value },
      update: { value },
    })
  } catch (error) {
    console.error('[webhook whatsapp] no se pudo anotar en la bitácora:', error)
  }
}
