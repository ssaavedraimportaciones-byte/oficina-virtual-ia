import type { WeekHours } from './types'
import type { LocalNow } from './agenda'

/**
 * Ventana para recibir pedidos por chat. Es opcional y la ajusta cada negocio:
 * apagada (lo de siempre), el agente toma pedidos a cualquier hora. Encendida,
 * solo los toma dentro del horario de atención, con dos márgenes editables:
 *
 * - `preorderMinutes`: cuántos minutos antes de abrir ya se aceptan pedidos
 *   (un food truck que abre a las 19:00 recibe desde las 18:00 y prepara desde
 *   las 19:00).
 * - `orderCutoffMinutes`: cuántos minutos antes de cerrar se deja de recibir
 *   (la cocina cierra antes que el local).
 *
 * Los horarios que pasan la medianoche (19:00 a 01:00) se entienden como un
 * solo turno.
 */

export interface OrderWindowSettings {
  ordersOnlyInHours: boolean
  preorderMinutes: number
  orderCutoffMinutes: number
}

export const ORDER_WINDOW_DEFAULTS: OrderWindowSettings = {
  ordersOnlyInHours: false,
  preorderMinutes: 0,
  orderCutoffMinutes: 0,
}

export const MAX_PREORDER_MINUTES = 240
export const MAX_CUTOFF_MINUTES = 180

export type OrderWindowStatus =
  /** Se aceptan pedidos y se preparan ya. */
  | { state: 'open' }
  /** Se aceptan, pero el local todavía no abre: se preparan desde `prepareAt`. */
  | { state: 'preorder'; prepareAt: string }
  /** No se aceptan ahora. `next` es cuándo vuelven (null si el local no abre ningún día). */
  | { state: 'closed'; next: { dayOffset: number; time: string } | null }

const DAY = 24 * 60

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function toTime(minutes: number): string {
  const m = ((minutes % DAY) + DAY) % DAY
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function weekdayOf(date: string): number {
  const [y, mo, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay()
}

interface Shift {
  /** Minutos desde el inicio de hoy (pueden ser negativos o pasar de un día). */
  acceptFrom: number
  open: number
  acceptUntil: number
}

/** Turnos de ayer a 7 días más, en minutos relativos al inicio de hoy. */
function shifts(hours: WeekHours, today: number, s: OrderWindowSettings): Shift[] {
  const out: Shift[] = []
  for (let k = -1; k <= 7; k += 1) {
    const h = hours[(((today + k) % 7) + 7) % 7]
    if (!h) continue
    const open = k * DAY + toMinutes(h.open)
    let close = k * DAY + toMinutes(h.close)
    if (close <= open) close += DAY
    const acceptFrom = open - Math.max(0, s.preorderMinutes)
    const acceptUntil = close - Math.max(0, s.orderCutoffMinutes)
    if (acceptUntil <= acceptFrom) continue
    out.push({ acceptFrom, open, acceptUntil })
  }
  return out
}

export function orderWindowAt(hours: WeekHours, settings: OrderWindowSettings, now: LocalNow): OrderWindowStatus {
  if (!settings.ordersOnlyInHours) return { state: 'open' }
  const nowMin = toMinutes(now.time)
  const list = shifts(hours, weekdayOf(now.date), settings)

  const current = list.find((s) => s.acceptFrom <= nowMin && nowMin < s.acceptUntil)
  if (current) return nowMin < current.open ? { state: 'preorder', prepareAt: toTime(current.open) } : { state: 'open' }

  const next = list.filter((s) => s.acceptFrom > nowMin).sort((a, b) => a.acceptFrom - b.acceptFrom)[0]
  if (!next) return { state: 'closed', next: null }
  return { state: 'closed', next: { dayOffset: Math.floor(next.acceptFrom / DAY), time: toTime(next.acceptFrom) } }
}

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function dayLabel(dayOffset: number, today: number): string {
  if (dayOffset === 0) return 'hoy'
  if (dayOffset === 1) return 'mañana'
  return `el ${DAY_NAMES[(today + dayOffset) % 7]}`
}

/** Lo que devuelve crear_pedido cuando no se puede pedir ahora. */
export function closedMessage(status: Extract<OrderWindowStatus, { state: 'closed' }>, now: LocalNow): string {
  if (!status.next) {
    return 'No se pueden tomar pedidos: el local no tiene días de atención cargados. No lo registres; dile al cliente que una persona del equipo le confirma.'
  }
  const when = `${dayLabel(status.next.dayOffset, weekdayOf(now.date))} desde las ${status.next.time}`
  return `No se pueden tomar pedidos ahora: el local recibe pedidos ${when}. No lo registres. Díselo al cliente con amabilidad, invítalo a escribir a esa hora y, si quiere, déjale lista la elección para que pedir sea rápido.`
}

/**
 * La regla en palabras para el prompt del agente (no depende de la hora, así
 * el prompt se puede cachear). Vacío si la opción está apagada.
 */
export function describeOrderWindow(hours: WeekHours, settings: OrderWindowSettings): string {
  if (!settings.ordersOnlyInHours) return ''
  const lines: string[] = []
  for (let d = 1; d <= 7; d += 1) {
    const day = d % 7 // lunes primero, domingo al final
    const h = hours[day]
    const name = DAY_NAMES[day]
    if (!h) {
      lines.push(`- ${name}: no se reciben pedidos`)
      continue
    }
    const open = toMinutes(h.open)
    let close = toMinutes(h.close)
    if (close <= open) close += DAY
    const from = open - Math.max(0, settings.preorderMinutes)
    const until = close - Math.max(0, settings.orderCutoffMinutes)
    if (until <= from) {
      lines.push(`- ${name}: no se reciben pedidos`)
      continue
    }
    const pre = from < open ? ` (los que llegan antes de las ${h.open} se preparan desde esa hora)` : ''
    lines.push(`- ${name}: pedidos de ${toTime(from)} a ${toTime(until)}${pre}`)
  }
  return lines.join('\n')
}
