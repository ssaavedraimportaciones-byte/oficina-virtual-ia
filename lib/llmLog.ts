import { prisma } from './db'

/**
 * Bitácora de las veces que la IA falló al responder un mensaje real.
 *
 * Cuando eso pasa el cliente recibe el mensaje de contingencia, y el motivo
 * (clave inválida, sin saldo, límite de uso, modelo retirado) solo quedaba en
 * los registros de Vercel. Acá queda en la base, donde se puede leer sin
 * entrar a Vercel. Igual que la bitácora del webhook: sin datos de clientes,
 * solo el negocio, el código y el motivo.
 */

const KEY = 'llm_error_log'
const MAX_ENTRIES = 20

export interface LlmErrorEntry {
  at: string
  businessId: string
  /** Código HTTP del proveedor, si lo hubo. */
  status: number | null
  /** El motivo en palabras, el mismo que se muestra en el panel. */
  reason: string
}

/** Por si el proveedor repite la clave en el mensaje de error. */
export function redactSecrets(text: string): string {
  return text.replace(/\b(sk|gsk|sk-ant|xai|AIza)[-_A-Za-z0-9]{8,}/g, '[clave oculta]')
}

export async function listLlmErrors(): Promise<LlmErrorEntry[]> {
  const row = await prisma.platformSetting.findUnique({ where: { key: KEY } })
  if (!row) return []
  try {
    const parsed = JSON.parse(row.value)
    return Array.isArray(parsed) ? (parsed as LlmErrorEntry[]) : []
  } catch {
    return []
  }
}

/** Nunca lanza: anotar no puede impedir que el cliente reciba el mensaje de contingencia. */
export async function recordLlmError(businessId: string, error: unknown, reason: string): Promise<void> {
  try {
    const status = (error as { status?: unknown })?.status
    const entry: LlmErrorEntry = {
      at: new Date().toISOString(),
      businessId,
      status: typeof status === 'number' ? status : null,
      reason: redactSecrets(reason).slice(0, 400),
    }
    const value = JSON.stringify([entry, ...(await listLlmErrors())].slice(0, MAX_ENTRIES))
    await prisma.platformSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } })
  } catch (logError) {
    console.error('[pipeline] no se pudo anotar el error de la IA:', logError)
  }
}
