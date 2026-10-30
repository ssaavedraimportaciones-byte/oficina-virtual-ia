import { beforeAll, describe, expect, it } from 'vitest'
import { addDays } from '../agenda'
import { runAgentTool } from '../agentTools'
import { buildSystemPrompt } from '../agentPrompt'
import {
  findTableByLabel,
  findTables,
  holdUntil,
  reservableTables,
  suggestTimes,
  summarizeFloors,
  tableTraits,
  type Floor,
  type FloorElement,
  type TableReservation,
} from '../mesas'
import {
  createFloor,
  listFloors,
  getReservationSettings,
  listReservations,
  markNoShow,
  reserveTable,
  saveFloorLayout,
  setReservationSettings,
} from '../mesasStore'
import * as store from '../store'
import type { AgentConfig, Business, Conversation, WeekHours } from '../types'

const HOURS: WeekHours = Array.from({ length: 7 }, () => ({ open: '12:00', close: '23:30' }))
// Una fecha futura fija relativa a hoy, para no depender del día en que corran.
const DAY = addDays(new Date().toISOString().slice(0, 10), 10)

let n = 0
function el(patch: Partial<FloorElement>): FloorElement {
  n += 1
  return {
    id: crypto.randomUUID(),
    kind: 'mesa',
    label: `Mesa ${n}`,
    x: 0,
    y: 0,
    width: 70,
    height: 70,
    shape: 'round',
    seats: 4,
    sun: null,
    zone: '',
    nearWindow: null,
    reservable: true,
    ...patch,
  }
}

function reservation(tableId: string, startsAt: string, durationMinutes = 120): TableReservation {
  return {
    id: crypto.randomUUID(),
    tableId,
    tableLabel: 'x',
    floorName: 'x',
    conversationId: null,
    contactName: 'Ana',
    contactHandle: '',
    partySize: 2,
    startsAt,
    durationMinutes,
    status: 'confirmado',
    note: '',
    createdAt: new Date().toISOString(),
  }
}

/** Primer piso: dos ventanas (una al sol, otra a la sombra), una terraza y mesas de 2, 4 y 8. */
function sampleFloor(): Floor {
  return {
    id: 'piso-1',
    name: 'Primer piso',
    position: 0,
    width: 1000,
    height: 600,
    elements: [
      el({ id: 'v1', kind: 'ventana', label: 'Ventana 1', x: 100, y: 0, width: 150, height: 12, sun: 'sol' }),
      el({ id: 'v2', kind: 'ventana', label: 'Ventana 2', x: 600, y: 0, width: 150, height: 12, sun: 'sombra' }),
      el({ id: 'terraza', kind: 'zona', label: 'Terraza', x: 0, y: 400, width: 400, height: 200 }),
      el({ id: 'm1', label: 'Mesa 1', x: 120, y: 30, seats: 2 }),
      el({ id: 'm2', label: 'Mesa 2', x: 620, y: 30, seats: 4 }),
      el({ id: 'm3', label: 'Mesa 3', x: 450, y: 250, seats: 4 }),
      el({ id: 'm4', label: 'Mesa 4', x: 100, y: 450, seats: 8, shape: 'rect', width: 140 }),
      el({ id: 'm5', label: 'Mesa 5', x: 800, y: 300, seats: 4, reservable: false }),
    ],
  }
}

describe('características de cada mesa según el dibujo', () => {
  const floor = sampleFloor()
  const table = (id: string) => floor.elements.find((e) => e.id === id)!

  it('una mesa pegada a una ventana es de ventana y hereda su lado', () => {
    expect(tableTraits(floor, table('m1'))).toEqual({ window: 'Ventana 1', sun: 'sol', zone: '' })
    expect(tableTraits(floor, table('m2'))).toEqual({ window: 'Ventana 2', sun: 'sombra', zone: '' })
  })

  it('una mesa lejos de las ventanas no es de ventana', () => {
    expect(tableTraits(floor, table('m3')).window).toBeNull()
  })

  it('una mesa dentro de una zona dibujada queda en ese sector', () => {
    expect(tableTraits(floor, table('m4')).zone).toBe('Terraza')
  })

  it('lo marcado a mano manda sobre el dibujo', () => {
    expect(tableTraits(floor, { ...table('m1'), nearWindow: false }).window).toBeNull()
    expect(tableTraits(floor, { ...table('m3'), nearWindow: true }).window).toBe('Ventana 2')
    expect(tableTraits(floor, { ...table('m1'), sun: 'sombra' }).sun).toBe('sombra')
    expect(tableTraits(floor, { ...table('m4'), zone: 'Patio' }).zone).toBe('Patio')
  })

  it('las mesas que no se reservan no cuentan', () => {
    expect(reservableTables([floor]).map((o) => o.table.id)).not.toContain('m5')
  })

  it('el resumen para el agente cuenta ventanas y mesas de ventana', () => {
    const summary = summarizeFloors([floor])
    expect(summary).toContain('Primer piso: 4 mesas de 2 a 8 personas')
    expect(summary).toContain('2 ventanas (Ventana 1, lado sol; Ventana 2, lado sombra)')
    expect(summary).toContain('2 mesas junto a ventana')
    expect(summary).toContain('sectores: Terraza')
  })
})

describe('búsqueda de mesa libre', () => {
  const floors = [sampleFloor()]
  const search = { date: DAY, time: '20:00', partySize: 2, durationMinutes: 120 }

  it('ofrece primero la mesa que mejor calza con la cantidad de personas', () => {
    const result = findTables(floors, [], HOURS, search)
    expect(result.ok && result.matches.map((o) => o.table.label)).toEqual(['Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4'])
  })

  it('filtra por ventana y lado, y deja aparte las que no cumplen', () => {
    const result = findTables(floors, [], HOURS, { ...search, prefs: { ventana: true, lado: 'sombra' } })
    expect(result.ok && result.matches.map((o) => o.table.label)).toEqual(['Mesa 2'])
    expect(result.ok && result.others.length).toBe(3)
  })

  it('filtra por sector', () => {
    const result = findTables(floors, [], HOURS, { ...search, prefs: { sector: 'terraza' } })
    expect(result.ok && result.matches.map((o) => o.table.label)).toEqual(['Mesa 4'])
  })

  it('no ofrece una mesa que se pisa con otra reserva', () => {
    const taken = [reservation('m1', `${DAY}T19:00`)]
    const result = findTables(floors, taken, HOURS, search)
    expect(result.ok && result.matches.map((o) => o.table.id)).not.toContain('m1')
    // A las 21:00 la de las 19:00 (dos horas) ya terminó.
    const later = findTables(floors, taken, HOURS, { ...search, time: '21:00' })
    expect(later.ok && later.matches.map((o) => o.table.id)).toContain('m1')
  })

  it('una reserva de la noche anterior que pasa la medianoche sigue ocupando la mesa', () => {
    const lateHours = HOURS.map(() => ({ open: '00:00', close: '23:59' }))
    const taken = [reservation('m1', `${addDays(DAY, -1)}T23:30`)]
    const result = findTables(floors, taken, lateHours, { ...search, time: '00:30' })
    expect(result.ok && result.matches.map((o) => o.table.id)).not.toContain('m1')
  })

  it('no reserva con el local cerrado ni sobre la hora de cierre', () => {
    const closed = [...HOURS]
    closed[new Date(`${DAY}T12:00:00Z`).getUTCDay()] = null
    expect(findTables(floors, [], closed, search)).toMatchObject({ ok: false })
    expect(findTables(floors, [], HOURS, { ...search, time: '23:00' })).toMatchObject({
      ok: false,
      reason: expect.stringContaining('de 12:00 a 22:30'),
    })
  })

  it('no reserva en el pasado', () => {
    const result = findTables(floors, [], HOURS, search, { date: DAY, time: '21:00' })
    expect(result).toEqual({ ok: false, reason: 'Ese horario ya pasó.' })
  })

  it('si son más que la mesa más grande, lo dice en vez de inventar', () => {
    const result = findTables(floors, [], HOURS, { ...search, partySize: 12 })
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining('para 8 personas') })
  })

  it('sugiere otras horas del día con lo que pidió el cliente', () => {
    const taken = [reservation('m2', `${DAY}T19:00`, 180)]
    const want = { ...search, prefs: { ventana: true, lado: 'sombra' as const } }
    const result = findTables(floors, taken, HOURS, want)
    expect(result.ok && result.matches).toEqual([])
    const times = suggestTimes(floors, taken, HOURS, want)
    expect(times).toContain('22:00')
    expect(times).not.toContain('20:30')
  })

  it('encuentra la mesa por su nombre y pide el piso si hay dos iguales', () => {
    const second: Floor = { ...sampleFloor(), id: 'piso-2', name: 'Segundo piso' }
    second.elements = second.elements.map((e) => ({ ...e, id: `${e.id}-b` }))
    expect(findTableByLabel([floors[0]], 'mesa 2')).toMatchObject({ table: { id: 'm2' } })
    expect(findTableByLabel([floors[0]], '2')).toMatchObject({ table: { id: 'm2' } })
    expect(findTableByLabel([floors[0], second], 'Mesa 2')).toBe('ambigua')
    expect(findTableByLabel([floors[0], second], 'Mesa 2', 'segundo')).toMatchObject({ table: { id: 'm2-b' } })
    expect(findTableByLabel([floors[0]], 'Mesa 99')).toBeNull()
  })
})

describe('mesas guardadas y el agente reservando', () => {
  let business: Business
  let conversation: Conversation
  const config: AgentConfig = {
    agentName: 'Tomás',
    businessName: 'La Ventana',
    industry: 'Restaurante',
    description: 'Cocina chilena',
    goals: 'Reservar mesas',
    tone: 'cercano',
    channels: ['whatsapp'],
    configuredAt: new Date().toISOString(),
  }

  beforeAll(async () => {
    business = await store.createBusiness(config, 'gastronomia')
    business = await store.updateBusinessHours(business.id, HOURS)
    const floor = await createFloor(business.id, 'Primer piso')
    const elements = sampleFloor().elements.map((e) => ({ ...e, id: crypto.randomUUID() }))
    const saved = await saveFloorLayout(floor.id, { name: 'Primer piso', width: 1000, height: 600, elements })
    expect(saved.ok).toBe(true)
    conversation = await store.createConversation({
      businessId: business.id,
      channel: 'whatsapp',
      contactName: 'Ana',
      contactHandle: '56911111111',
    })
  })

  it('el croquis guardado vuelve igual', async () => {
    const [floor] = await listFloors(business.id)
    expect(floor.elements).toHaveLength(8)
    expect(reservableTables([floor])).toHaveLength(4)
  })

  it('no deja meter en un piso un elemento que es de otro', async () => {
    const other = await createFloor(business.id, 'Segundo piso')
    const [first] = await listFloors(business.id)
    const stolen = first.elements[0]
    const result = await saveFloorLayout(other.id, { name: 'Segundo piso', width: 1000, height: 600, elements: [stolen] })
    expect(result).toEqual({ ok: false, reason: 'Algún elemento pertenece a otro piso.' })
  })

  it('el agente consulta y describe dónde queda la mesa', async () => {
    const out = await runAgentTool({ business, conversation }, 'consultar_mesas', {
      fecha: DAY,
      hora: '20:00',
      personas: 2,
      ventana: true,
      lado: 'sombra',
    })
    expect(out).toContain('Mesas libres')
    expect(out).toContain('Mesa 2 (Primer piso, 4 personas, junto a Ventana 2, lado sombra)')
    expect(out).not.toContain('Mesa 1')
  })

  it('el agente reserva y la mesa queda tomada', async () => {
    const out = await runAgentTool({ business, conversation }, 'reservar_mesa', {
      mesa: 'Mesa 2',
      fecha: DAY,
      hora: '20:00',
      personas: 3,
      nombre_cliente: 'Ana Pérez',
      nota: 'Cumpleaños',
    })
    expect(out).toContain('Mesa reservada')
    // Avisa la tolerancia al confirmar
    expect(out).toContain('hasta 15 minutos después de la hora (hasta las 20:15)')
    const [r] = (await listReservations(business.id)).filter((x) => x.tableLabel === 'Mesa 2')
    expect(r).toMatchObject({ startsAt: `${DAY}T20:00`, partySize: 3, contactName: 'Ana Pérez', note: 'Cumpleaños', durationMinutes: 120 })

    const again = await runAgentTool({ business, conversation }, 'consultar_mesas', {
      fecha: DAY,
      hora: '21:00',
      personas: 2,
      ventana: true,
      lado: 'sombra',
    })
    expect(again).toContain('No hay ninguna mesa libre')
    expect(again).toContain('otras horas')
  })

  it('no reserva más personas de las que caben', async () => {
    const out = await runAgentTool({ business, conversation }, 'reservar_mesa', {
      mesa: 'Mesa 1',
      fecha: DAY,
      hora: '13:00',
      personas: 5,
      nombre_cliente: 'Pedro',
    })
    expect(out).toContain('para 2 personas como máximo')
  })

  it('dos reservas simultáneas de la misma mesa: solo una queda', async () => {
    const option = reservableTables(await listFloors(business.id)).find((o) => o.table.label === 'Mesa 3')!
    const attempt = (name: string) =>
      reserveTable({
        businessId: business.id,
        hours: HOURS,
        option,
        date: DAY,
        time: '14:00',
        partySize: 2,
        durationMinutes: 120,
        contactName: name,
        contactHandle: '',
        conversationId: null,
        enforceHours: true,
      })
    const results = await Promise.all([attempt('Uno'), attempt('Dos'), attempt('Tres')])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
  })

  it('el prompt describe el local y no habla de agenda de horas', () => {
    const floors = [sampleFloor()]
    const prompt = buildSystemPrompt(config, [], [], [], floors)
    expect(prompt).toContain('# Reservas de mesa')
    expect(prompt).toContain('2 ventanas')
    expect(prompt).not.toContain('no cargó su agenda')
  })

  it('la tolerancia se configura y el agente la avisa con el valor nuevo', async () => {
    await setReservationSettings(business.id, { durationMinutes: 90, graceMinutes: 20 })
    expect(await getReservationSettings(business.id)).toEqual({ durationMinutes: 90, graceMinutes: 20 })
    const out = await runAgentTool({ business, conversation }, 'reservar_mesa', {
      mesa: 'Mesa 4',
      fecha: DAY,
      hora: '19:50',
      personas: 6,
      nombre_cliente: 'Grupo Soto',
    })
    expect(out).toContain('hasta 20 minutos después de la hora (hasta las 20:10)')
    await setReservationSettings(business.id, { durationMinutes: 120, graceMinutes: 15 })
  })

  it('si el cliente no llegó, marcarlo libera la mesa', async () => {
    const floors = await listFloors(business.id)
    const option = reservableTables(floors).find((o) => o.table.label === 'Mesa 1')!
    const made = await reserveTable({
      businessId: business.id,
      hours: HOURS,
      option,
      date: DAY,
      time: '13:00',
      partySize: 2,
      durationMinutes: 120,
      contactName: 'No vino',
      contactHandle: '',
      conversationId: null,
      enforceHours: true,
    })
    expect(made.ok).toBe(true)
    const search = { date: DAY, time: '13:30', partySize: 2, durationMinutes: 120 }
    const taken = findTables(floors, await listReservations(business.id), HOURS, search)
    expect(taken.ok && taken.matches.map((o) => o.table.label)).not.toContain('Mesa 1')

    if (!made.ok) return
    const marked = await markNoShow(made.reservation.id)
    expect(marked.status).toBe('no_llego')
    const free = findTables(floors, await listReservations(business.id), HOURS, search)
    expect(free.ok && free.matches.map((o) => o.table.label)).toContain('Mesa 1')
  })
})

describe('hasta cuándo se guarda la mesa', () => {
  it('suma la tolerancia, también pasada la medianoche', () => {
    expect(holdUntil('20:30', 15)).toBe('20:45')
    expect(holdUntil('23:50', 15)).toBe('00:05')
  })
})
