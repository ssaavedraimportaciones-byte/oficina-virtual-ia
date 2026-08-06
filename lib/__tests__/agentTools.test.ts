import { beforeAll, describe, expect, it } from 'vitest'
import { rm } from 'fs/promises'

const DB = '.data/test-tools.json'
process.env.DB_PATH = DB

const { runAgentTool } = await import('../agentTools')
const store = await import('../store')
import type { Business, Conversation } from '../types'

let business: Business
let conversation: Conversation

// Un lunes futuro, para no depender del día en que corran los tests.
function nextMonday(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7))
  return d.toISOString().slice(0, 10)
}
const MONDAY = nextMonday()

beforeAll(async () => {
  await rm(DB, { force: true })
  business = await store.createBusiness(
    {
      agentName: 'Bella', businessName: 'Uñas Bella', industry: 'Manicura',
      description: 'x', goals: 'y', tone: 'cercano', channels: ['whatsapp'],
      configuredAt: new Date().toISOString(),
    },
    'manicura',
  )
  await store.addService({
    businessId: business.id, name: 'Semipermanente', durationMinutes: 60, price: '$8000',
  })
  conversation = await store.createConversation({
    businessId: business.id, channel: 'whatsapp',
    contactName: 'Ana', contactHandle: '5491100000001',
  })
})

describe('herramientas del agente', () => {
  it('consulta disponibilidad de un servicio real', async () => {
    const out = await runAgentTool({ business, conversation }, 'consultar_disponibilidad', {
      servicio: 'Semipermanente', desde: MONDAY,
    })
    expect(out).toContain('Semipermanente')
    expect(out).toContain('09:00')
  })

  it('avisa cuando el servicio no existe, sin inventarlo', async () => {
    const out = await runAgentTool({ business, conversation }, 'consultar_disponibilidad', {
      servicio: 'Masaje tailandés',
    })
    expect(out).toContain('No encontré ese servicio')
    expect(out).toContain('Semipermanente')
  })

  it('reserva un turno de verdad', async () => {
    const out = await runAgentTool({ business, conversation }, 'agendar_turno', {
      servicio: 'Semipermanente', fecha: MONDAY, hora: '10:00', nombre_cliente: 'Ana',
    })
    expect(out).toContain('Turno confirmado')

    const appointments = await store.listAppointments(business.id)
    expect(appointments).toHaveLength(1)
    expect(appointments[0].startsAt).toBe(`${MONDAY}T10:00`)
    expect(appointments[0].contactName).toBe('Ana')
  })

  it('no permite reservar dos veces el mismo horario', async () => {
    const out = await runAgentTool({ business, conversation }, 'agendar_turno', {
      servicio: 'Semipermanente', fecha: MONDAY, hora: '10:30', nombre_cliente: 'Pedro',
    })
    expect(out).toContain('No se pudo reservar')
    expect(await store.listAppointments(business.id)).toHaveLength(1)
  })

  it('el horario reservado desaparece de la disponibilidad', async () => {
    const out = await runAgentTool({ business, conversation }, 'consultar_disponibilidad', {
      servicio: 'Semipermanente', desde: MONDAY,
    })
    const mondayLine = out.split('\n').find((l) => l.includes(MONDAY)) ?? ''
    expect(mondayLine).not.toContain('10:00')
    expect(mondayLine).toContain('09:00')
  })

  it('rechaza fuera del horario de atención', async () => {
    const out = await runAgentTool({ business, conversation }, 'agendar_turno', {
      servicio: 'Semipermanente', fecha: MONDAY, hora: '23:00', nombre_cliente: 'Ana',
    })
    expect(out).toContain('fuera de la atención')
  })

  it('pide los datos que faltan en vez de reservar incompleto', async () => {
    const out = await runAgentTool({ business, conversation }, 'agendar_turno', {
      servicio: 'Semipermanente', fecha: MONDAY,
    })
    expect(out).toContain('Faltan datos')
  })
})
