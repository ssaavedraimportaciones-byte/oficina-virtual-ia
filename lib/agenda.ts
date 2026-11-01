import type { Appointment, Professional, Service, WeekHours } from './types'

/** Granularidad de la grilla de horas, en minutos. */
const SLOT_STEP = 30

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** "2026-08-07T14:00" -> minutos desde la medianoche de ese día. */
function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function splitLocal(value: string): { date: string; time: string } {
  const [date, time = '00:00'] = value.split('T')
  return { date, time: time.slice(0, 5) }
}

export function buildLocal(date: string, time: string): string {
  return `${date}T${time}`
}

/** Día de la semana (0=domingo) de una fecha "YYYY-MM-DD", sin tocar zonas horarias. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return next.toISOString().slice(0, 10)
}

export function formatDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${DAY_NAMES[weekdayOf(date)]} ${d}/${m}/${y}`
}

function overlaps(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && startB < endA
}

/** Fecha y hora local actual del negocio (ver lib/timezone.ts). */
export interface LocalNow {
  date: string
  time: string
}

/** Si la hora ya empezó (o empieza ahora), no se puede ofrecer ni reservar. */
function isPast(date: string, startMinutes: number, now?: LocalNow): boolean {
  if (!now) return false
  if (date !== now.date) return date < now.date
  return startMinutes <= minutesOfDay(now.time)
}

/**
 * Horarios libres para un servicio en un rango de fechas. Recorre día por día
 * el horario de atención y descarta los que se pisan con una hora ya
 * confirmada y, si se pasa `now`, los que ya pasaron.
 */
export function getAvailableSlots(
  hours: WeekHours,
  appointments: Appointment[],
  durationMinutes: number,
  fromDate: string,
  toDate: string,
  limit = 40,
  now?: LocalNow,
): { date: string; time: string }[] {
  const slots: { date: string; time: string }[] = []
  const confirmed = appointments.filter((a) => a.status === 'confirmado')

  let date = fromDate
  let guard = 0
  while (date <= toDate && slots.length < limit && guard < 120) {
    guard += 1
    const dayHours = hours[weekdayOf(date)]
    if (!dayHours) {
      date = addDays(date, 1)
      continue
    }

    const open = minutesOfDay(dayHours.open)
    const close = minutesOfDay(dayHours.close)
    const taken = confirmed
      .filter((a) => splitLocal(a.startsAt).date === date)
      .map((a) => {
        const start = minutesOfDay(splitLocal(a.startsAt).time)
        return { start, end: start + a.durationMinutes }
      })

    for (let start = open; start + durationMinutes <= close; start += SLOT_STEP) {
      const end = start + durationMinutes
      const busy = taken.some((t) => overlaps(start, end, t.start, t.end))
      if (!busy && !isPast(date, start, now)) slots.push({ date, time: toTime(start) })
      if (slots.length >= limit) break
    }

    date = addDays(date, 1)
  }

  return slots
}

/** Verifica que un horario puntual siga libre antes de confirmar la reserva. */
export function isSlotFree(
  hours: WeekHours,
  appointments: Appointment[],
  startsAt: string,
  durationMinutes: number,
  now?: LocalNow,
): { ok: true } | { ok: false; reason: string } {
  const { date, time } = splitLocal(startsAt)
  if (isPast(date, minutesOfDay(time), now)) {
    return { ok: false, reason: 'Ese horario ya pasó.' }
  }
  const dayHours = hours[weekdayOf(date)]
  if (!dayHours) {
    return { ok: false, reason: `El ${formatDateLabel(date)} el negocio no atiende.` }
  }

  const start = minutesOfDay(time)
  const end = start + durationMinutes
  if (start < minutesOfDay(dayHours.open) || end > minutesOfDay(dayHours.close)) {
    return {
      ok: false,
      reason: `Ese horario queda fuera de la atención (${dayHours.open} a ${dayHours.close}).`,
    }
  }

  const clash = appointments
    .filter((a) => a.status === 'confirmado' && splitLocal(a.startsAt).date === date)
    .some((a) => {
      const otherStart = minutesOfDay(splitLocal(a.startsAt).time)
      return overlaps(start, end, otherStart, otherStart + a.durationMinutes)
    })

  if (clash) return { ok: false, reason: 'Ese horario ya está ocupado.' }
  return { ok: true }
}

export function findServiceByName(services: Service[], name: string): Service | null {
  const normalized = name.trim().toLowerCase()
  return (
    services.find((s) => s.name.toLowerCase() === normalized) ??
    services.find((s) => s.name.toLowerCase().includes(normalized)) ??
    services.find((s) => normalized.includes(s.name.toLowerCase())) ??
    null
  )
}

/** Sin acentos ni mayúsculas, para comparar nombres como los escribe un cliente. */
function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

export function findProfessionalByName(team: Professional[], name: string): Professional | null {
  const wanted = normalizeName(name)
  if (!wanted) return null
  return (
    team.find((p) => normalizeName(p.name) === wanted) ??
    team.find((p) => normalizeName(p.name).split(' ')[0] === wanted) ??
    team.find((p) => normalizeName(p.name).includes(wanted)) ??
    null
  )
}

/**
 * Las horas de una persona: las suyas, más las que se tomaron cuando todavía no
 * había equipo cargado (sin profesional), que bloquean a todos para no pisarse.
 */
function appointmentsOf(appointments: Appointment[], professionalId: string): Appointment[] {
  return appointments.filter((a) => !a.professionalId || a.professionalId === professionalId)
}

export interface TeamSlot {
  date: string
  time: string
  /** Quiénes están libres a esa hora. */
  free: Professional[]
}

/** Horarios libres de un equipo: una hora sirve si al menos una de las personas está libre. */
export function getAvailableTeamSlots(
  hours: WeekHours,
  appointments: Appointment[],
  team: Professional[],
  durationMinutes: number,
  fromDate: string,
  toDate: string,
  limit = 40,
  now?: LocalNow,
): TeamSlot[] {
  const byKey = new Map<string, TeamSlot>()
  for (const person of team) {
    const slots = getAvailableSlots(
      hours,
      appointmentsOf(appointments, person.id),
      durationMinutes,
      fromDate,
      toDate,
      400,
      now,
    )
    for (const slot of slots) {
      const key = `${slot.date}T${slot.time}`
      const entry = byKey.get(key) ?? { ...slot, free: [] }
      entry.free.push(person)
      byKey.set(key, entry)
    }
  }
  return [...byKey.values()]
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, limit)
}

/**
 * Elige quién atiende una hora: la persona pedida si está libre; si no pidió a
 * nadie, la que tenga menos horas ese día, para repartir el trabajo.
 */
export function assignProfessional(
  hours: WeekHours,
  appointments: Appointment[],
  team: Professional[],
  startsAt: string,
  durationMinutes: number,
  now: LocalNow | undefined,
  preferred?: Professional | null,
): { ok: true; professional: Professional } | { ok: false; reason: string } {
  const candidates = preferred ? [preferred] : team
  if (candidates.length === 0) return { ok: false, reason: 'No hay nadie del equipo disponible.' }
  const date = splitLocal(startsAt).date
  const free = candidates.filter(
    (p) => isSlotFree(hours, appointmentsOf(appointments, p.id), startsAt, durationMinutes, now).ok,
  )
  if (free.length === 0) {
    const reason = isSlotFree(
      hours,
      appointmentsOf(appointments, candidates[0].id),
      startsAt,
      durationMinutes,
      now,
    )
    const base = reason.ok ? 'Ese horario ya está ocupado.' : reason.reason
    return { ok: false, reason: preferred ? `${preferred.name}: ${base}` : base }
  }
  const load = (p: Professional) =>
    appointments.filter(
      (a) => a.status === 'confirmado' && a.professionalId === p.id && splitLocal(a.startsAt).date === date,
    ).length
  free.sort((a, b) => load(a) - load(b))
  return { ok: true, professional: free[0] }
}
