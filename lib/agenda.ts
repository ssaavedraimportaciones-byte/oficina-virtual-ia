import type { Appointment, Service, WeekHours } from './types'

/** Granularidad de la grilla de turnos, en minutos. */
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

/**
 * Turnos libres para un servicio en un rango de fechas. Recorre día por día
 * el horario de atención y descarta los que se pisan con un turno ya
 * confirmado.
 */
export function getAvailableSlots(
  hours: WeekHours,
  appointments: Appointment[],
  durationMinutes: number,
  fromDate: string,
  toDate: string,
  limit = 40,
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
      if (!busy) slots.push({ date, time: toTime(start) })
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
): { ok: true } | { ok: false; reason: string } {
  const { date, time } = splitLocal(startsAt)
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
