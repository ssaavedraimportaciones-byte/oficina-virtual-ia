import { prisma } from './db'
import { addDays, type LocalNow } from './agenda'
import {
  checkReservationTime,
  isTableFree,
  type ElementKind,
  type Floor,
  type FloorElement,
  type ReservationSettings,
  type ReservationStatus,
  type SunSide,
  type TableOption,
  type TableReservation,
} from './mesas'
import type { WeekHours } from './types'

/** Persistencia de pisos, croquis y reservas de mesa. Las reglas están en `mesas.ts`. */

function mapElement(row: {
  id: string
  kind: string
  label: string
  x: number
  y: number
  width: number
  height: number
  shape: string
  seats: number
  sun: string | null
  zone: string
  nearWindow: boolean | null
  reservable: boolean
}): FloorElement {
  return {
    id: row.id,
    kind: row.kind as ElementKind,
    label: row.label,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    shape: row.shape === 'round' ? 'round' : 'rect',
    seats: row.seats,
    sun: (row.sun as SunSide | null) ?? null,
    zone: row.zone,
    nearWindow: row.nearWindow,
    reservable: row.reservable,
  }
}

function mapReservation(row: {
  id: string
  tableId: string | null
  tableLabel: string
  floorName: string
  conversationId: string | null
  contactName: string
  contactHandle: string
  partySize: number
  startsAt: string
  durationMinutes: number
  status: string
  note: string
  createdAt: Date
}): TableReservation {
  return { ...row, status: row.status as ReservationStatus, createdAt: row.createdAt.toISOString() }
}

export async function listFloors(businessId: string): Promise<Floor[]> {
  const rows = await prisma.floor.findMany({
    where: { businessId },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    include: { elements: { orderBy: { id: 'asc' } } },
  })
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    position: row.position,
    width: row.width,
    height: row.height,
    elements: row.elements.map(mapElement),
  }))
}

export async function createFloor(businessId: string, name: string): Promise<Floor> {
  const position = await prisma.floor.count({ where: { businessId } })
  const row = await prisma.floor.create({ data: { businessId, name, position } })
  return { id: row.id, name: row.name, position: row.position, width: row.width, height: row.height, elements: [] }
}

export async function getFloorBusinessId(id: string): Promise<string | null> {
  const row = await prisma.floor.findUnique({ where: { id }, select: { businessId: true } })
  return row?.businessId ?? null
}

export async function deleteFloor(id: string): Promise<void> {
  await prisma.floor.deleteMany({ where: { id } })
}

/**
 * Guarda el croquis entero de un piso: lo que no viene se borra (sus reservas
 * quedan, sin mesa). Los ids los genera el navegador, así que un id que ya es
 * de otro piso se rechaza: no se puede "mudar" la mesa de otro negocio.
 */
export async function saveFloorLayout(
  floorId: string,
  layout: { name: string; width: number; height: number; elements: FloorElement[] },
): Promise<{ ok: true; floor: Floor } | { ok: false; reason: string }> {
  const ids = layout.elements.map((e) => e.id)
  if (new Set(ids).size !== ids.length) return { ok: false, reason: 'Hay dos elementos con el mismo id.' }

  const foreign = await prisma.floorElement.count({ where: { id: { in: ids }, floorId: { not: floorId } } })
  if (foreign > 0) return { ok: false, reason: 'Algún elemento pertenece a otro piso.' }

  await prisma.$transaction([
    prisma.floor.update({
      where: { id: floorId },
      data: { name: layout.name, width: layout.width, height: layout.height },
    }),
    prisma.floorElement.deleteMany({ where: { floorId, id: { notIn: ids } } }),
    ...layout.elements.map(({ id, ...data }) =>
      prisma.floorElement.upsert({
        where: { id },
        create: { id, floorId, ...data },
        update: data,
      }),
    ),
  ])

  const row = await prisma.floor.findUniqueOrThrow({
    where: { id: floorId },
    include: { elements: { orderBy: { id: 'asc' } } },
  })
  return {
    ok: true,
    floor: {
      id: row.id,
      name: row.name,
      position: row.position,
      width: row.width,
      height: row.height,
      elements: row.elements.map(mapElement),
    },
  }
}

/** Reservas desde ayer en adelante: las de ayer pueden seguir ocupando la mesa pasada la medianoche. */
export async function listReservations(businessId: string, today?: string): Promise<TableReservation[]> {
  const rows = await prisma.tableReservation.findMany({
    where: { businessId, ...(today ? { startsAt: { gte: addDays(today, -1) } } : {}) },
    orderBy: { startsAt: 'asc' },
  })
  return rows.map(mapReservation)
}

export async function getReservationBusinessId(id: string): Promise<string | null> {
  const row = await prisma.tableReservation.findUnique({ where: { id }, select: { businessId: true } })
  return row?.businessId ?? null
}

export async function cancelReservation(id: string): Promise<TableReservation> {
  return mapReservation(
    await prisma.tableReservation.update({ where: { id }, data: { status: 'cancelado' } }),
  )
}

export async function getReservationSettings(businessId: string): Promise<ReservationSettings> {
  const row = await prisma.business.findUnique({
    where: { id: businessId },
    select: { reservationMinutes: true, reservationGraceMinutes: true },
  })
  return { durationMinutes: row?.reservationMinutes ?? 120, graceMinutes: row?.reservationGraceMinutes ?? 15 }
}

export async function setReservationSettings(businessId: string, settings: ReservationSettings): Promise<void> {
  await prisma.business.update({
    where: { id: businessId },
    data: { reservationMinutes: settings.durationMinutes, reservationGraceMinutes: settings.graceMinutes },
  })
}

/** El cliente no llegó: la reserva queda en el historial y la mesa vuelve a estar libre. */
export async function markNoShow(id: string): Promise<TableReservation> {
  return mapReservation(
    await prisma.tableReservation.update({ where: { id }, data: { status: 'no_llego' } }),
  )
}

export interface ReserveInput {
  businessId: string
  hours: WeekHours
  option: TableOption
  date: string
  time: string
  partySize: number
  durationMinutes: number
  contactName: string
  contactHandle: string
  conversationId: string | null
  note?: string
  /** El dueño puede anotar una reserva fuera de horario; el agente no. */
  enforceHours: boolean
  now?: LocalNow
}

/**
 * Reserva la mesa revalidando adentro de una transacción con un candado por
 * mesa: si dos clientes piden la misma mesa al mismo tiempo, el segundo
 * espera al primero y ve su reserva, en vez de quedar los dos confirmados.
 */
export async function reserveTable(
  input: ReserveInput,
): Promise<{ ok: true; reservation: TableReservation } | { ok: false; reason: string }> {
  const { option } = input
  if (input.partySize > option.table.seats) {
    return { ok: false, reason: `${option.table.label} es para ${option.table.seats} personas como máximo.` }
  }
  if (input.enforceHours) {
    const time = checkReservationTime(input.hours, input.date, input.time, input.now)
    if (!time.ok) return time
  }

  const [h, m] = input.time.split(':').map(Number)
  const start = h * 60 + m

  return prisma.$transaction(async (tx) => {
    // $executeRaw y no $queryRaw: Prisma no sabe leer la columna `void` que devuelve.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${option.table.id}))`
    const existing = await tx.tableReservation.findMany({
      where: {
        tableId: option.table.id,
        status: 'confirmado',
        startsAt: { gte: addDays(input.date, -1), lt: addDays(input.date, 1) },
      },
    })
    if (!isTableFree(option.table.id, existing.map(mapReservation), input.date, start, input.durationMinutes)) {
      return { ok: false as const, reason: `${option.table.label} ya está reservada a esa hora.` }
    }
    const row = await tx.tableReservation.create({
      data: {
        businessId: input.businessId,
        tableId: option.table.id,
        tableLabel: option.table.label,
        floorName: option.floor.name,
        conversationId: input.conversationId,
        contactName: input.contactName,
        contactHandle: input.contactHandle,
        partySize: input.partySize,
        startsAt: `${input.date}T${input.time}`,
        durationMinutes: input.durationMinutes,
        note: input.note ?? '',
      },
    })
    return { ok: true as const, reservation: mapReservation(row) }
  })
}
