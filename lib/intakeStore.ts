import { randomUUID } from 'crypto'
import { prisma } from './db'
import { normalizeSteps, type ClientIntake, type ClientIntakeInput } from './intake'

/**
 * Dónde se guardan las altas de clientes.
 *
 * Como JSON en `platform_settings` en vez de una tabla propia: son pocas
 * fichas, las lee y escribe una sola persona, y así no hace falta migrar la
 * base para algo que es, en el fondo, una libreta. Si esto crece (varios
 * vendedores, historial, reportes), toca pasarlo a su propia tabla.
 */

const KEY = 'client_intakes'

function parse(value: string): ClientIntake[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as ClientIntake[]) : []
  } catch {
    // Un JSON roto no puede tumbar la pantalla del propietario: se empieza de
    // cero en memoria y la próxima escritura lo deja sano.
    return []
  }
}

export async function listIntakes(): Promise<ClientIntake[]> {
  const row = await prisma.platformSetting.findUnique({ where: { key: KEY } })
  if (!row) return []
  return parse(row.value).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

async function save(items: ClientIntake[]): Promise<void> {
  const value = JSON.stringify(items)
  await prisma.platformSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value },
    update: { value },
  })
}

export async function createIntake(input: ClientIntakeInput): Promise<ClientIntake> {
  const intake: ClientIntake = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    steps: [],
    businessId: null,
  }
  await save([intake, ...(await listIntakes())])
  return intake
}

export async function updateIntake(
  id: string,
  patch: Partial<Pick<ClientIntake, 'steps' | 'notes' | 'businessId'>>,
): Promise<ClientIntake | null> {
  const items = await listIntakes()
  const index = items.findIndex((item) => item.id === id)
  if (index === -1) return null

  items[index] = {
    ...items[index],
    steps: patch.steps ? normalizeSteps(patch.steps) : items[index].steps,
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    ...(patch.businessId !== undefined ? { businessId: patch.businessId } : {}),
  }
  await save(items)
  return items[index]
}

export async function deleteIntake(id: string): Promise<void> {
  const items = await listIntakes()
  await save(items.filter((item) => item.id !== id))
}
