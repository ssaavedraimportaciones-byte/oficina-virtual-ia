import { addDays, formatDateLabel, weekdayOf, type LocalNow } from './agenda'
import type { WeekHours } from './types'

/**
 * Mesas y reservas para restaurantes: el croquis de cada piso y las reglas
 * para saber qué mesa está libre y cómo describirla.
 *
 * Acá viven solo las formas y las reglas, sin tocar la base: el editor del
 * croquis corre en el navegador y la importa (lo mismo que `intake.ts`). La
 * persistencia está en `mesasStore.ts`.
 *
 * Las características de una mesa ("junto a la ventana 2", "lado sol",
 * "terraza") se pueden cargar a mano, pero lo normal es que salgan del dibujo:
 * una mesa pegada a una ventana es "de ventana" y hereda su lado; una mesa
 * dentro de una zona dibujada pertenece a esa zona. Así el dueño dibuja una
 * vez y no tiene que marcar mesa por mesa.
 */

export const ELEMENT_KINDS = ['mesa', 'ventana', 'puerta', 'barra', 'muro', 'zona'] as const
export type ElementKind = (typeof ELEMENT_KINDS)[number]

export const SUN_SIDES = ['sol', 'sombra'] as const
export type SunSide = (typeof SUN_SIDES)[number]

export interface FloorElement {
  id: string
  kind: ElementKind
  label: string
  x: number
  y: number
  width: number
  height: number
  shape: 'rect' | 'round'
  seats: number
  sun: SunSide | null
  zone: string
  nearWindow: boolean | null
  reservable: boolean
}

export interface Floor {
  id: string
  name: string
  position: number
  width: number
  height: number
  elements: FloorElement[]
}

export type ReservationStatus = 'confirmado' | 'cancelado'

export interface TableReservation {
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
  status: ReservationStatus
  note: string
  createdAt: string
}

/** Lienzo y límites del croquis, en unidades del dibujo. */
export const CANVAS = { minSize: 200, maxSize: 4000, maxElements: 400 } as const

/**
 * Hasta qué distancia (en unidades del lienzo) una mesa cuenta como "junto a
 * la ventana". Con el lienzo por defecto de 1000 de ancho es más o menos una
 * mesa de separación.
 */
export const WINDOW_REACH = 80

/** No se toman reservas que empiecen a menos de esto del cierre. */
export const LAST_SEATING_MINUTES = 60

const STEP = 30

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** Minúsculas y sin tildes: "Salón" y "salon" son lo mismo para el cliente. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

/** Separación entre dos rectángulos; 0 si se tocan o se pisan. */
function gap(a: FloorElement, b: FloorElement): number {
  const dx = Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width))
  const dy = Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height))
  return Math.hypot(dx, dy)
}

function contains(area: FloorElement, el: FloorElement): boolean {
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  return cx >= area.x && cx <= area.x + area.width && cy >= area.y && cy <= area.y + area.height
}

export interface TableTraits {
  /** Nombre de la ventana junto a la que está, o null. */
  window: string | null
  sun: SunSide | null
  /** Sector: el cargado a mano o el de la zona dibujada que la contiene. */
  zone: string
}

export function tableTraits(floor: Floor, table: FloorElement): TableTraits {
  const windows = floor.elements.filter((e) => e.kind === 'ventana')
  const nearest = windows
    .map((w) => ({ w, d: gap(table, w) }))
    .sort((a, b) => a.d - b.d)[0]

  const near = table.nearWindow ?? (nearest !== undefined && nearest.d <= WINDOW_REACH)
  const win = near ? (nearest?.w ?? null) : null
  const area = floor.elements.find((e) => e.kind === 'zona' && contains(e, table)) ?? null

  return {
    // Marcada a mano como de ventana sin ninguna dibujada: igual cuenta.
    window: near ? (win?.label ?? 'Ventana') : null,
    sun: table.sun ?? win?.sun ?? area?.sun ?? null,
    zone: table.zone.trim() || area?.label || '',
  }
}

export interface TableOption {
  floor: Floor
  table: FloorElement
  traits: TableTraits
}

/** Las mesas que se pueden reservar, de todos los pisos. */
export function reservableTables(floors: Floor[]): TableOption[] {
  return floors.flatMap((floor) =>
    floor.elements
      .filter((e) => e.kind === 'mesa' && e.reservable && e.seats > 0)
      .map((table) => ({ floor, table, traits: tableTraits(floor, table) })),
  )
}

export function describeTable(option: TableOption): string {
  const { floor, table, traits } = option
  const parts = [floor.name, `${table.seats} ${table.seats === 1 ? 'persona' : 'personas'}`]
  if (traits.window) parts.push(`junto a ${traits.window}`)
  if (traits.sun) parts.push(`lado ${traits.sun}`)
  if (traits.zone) parts.push(traits.zone)
  return `${table.label} (${parts.join(', ')})`
}

export interface TablePrefs {
  /** true = junto a ventana; false = lejos de ventana; undefined = da igual. */
  ventana?: boolean
  lado?: SunSide
  piso?: string
  sector?: string
}

export function matchesPrefs(option: TableOption, prefs: TablePrefs = {}): boolean {
  if (prefs.ventana === true && !option.traits.window) return false
  if (prefs.ventana === false && option.traits.window) return false
  if (prefs.lado && option.traits.sun !== prefs.lado) return false
  if (prefs.piso && !normalize(option.floor.name).includes(normalize(prefs.piso))) return false
  if (prefs.sector) {
    const wanted = normalize(prefs.sector)
    const where = normalize(`${option.traits.zone} ${option.floor.name}`)
    if (!where.includes(wanted)) return false
  }
  return true
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

/**
 * ¿La mesa está libre de `start` a `start + duration` ese día? Se mira
 * también el día anterior: una reserva de las 23:30 sigue ocupando la mesa
 * pasada la medianoche.
 */
export function isTableFree(
  tableId: string,
  reservations: TableReservation[],
  date: string,
  startMinutes: number,
  durationMinutes: number,
): boolean {
  const end = startMinutes + durationMinutes
  return !reservations.some((r) => {
    if (r.status !== 'confirmado' || r.tableId !== tableId) return false
    const [rDate, rTime] = r.startsAt.split('T')
    let rStart = minutesOf(rTime)
    if (rDate === addDays(date, -1)) rStart -= 24 * 60
    else if (rDate !== date) return false
    return overlaps(startMinutes, end, rStart, rStart + r.durationMinutes)
  })
}

/** Valida que se pueda reservar a esa hora: atención, último turno y que no haya pasado. */
export function checkReservationTime(
  hours: WeekHours,
  date: string,
  time: string,
  now?: LocalNow,
): { ok: true } | { ok: false; reason: string } {
  const start = minutesOf(time)
  if (now && (date < now.date || (date === now.date && start <= minutesOf(now.time)))) {
    return { ok: false, reason: 'Ese horario ya pasó.' }
  }
  const day = hours[weekdayOf(date)]
  if (!day) return { ok: false, reason: `El ${formatDateLabel(date)} el local está cerrado.` }
  const lastSeating = minutesOf(day.close) - LAST_SEATING_MINUTES
  if (start < minutesOf(day.open) || start > lastSeating) {
    return {
      ok: false,
      reason: `Ese día se reciben reservas de ${day.open} a ${toTime(Math.max(minutesOf(day.open), lastSeating))}.`,
    }
  }
  return { ok: true }
}

export interface TableSearch {
  date: string
  time: string
  partySize: number
  durationMinutes: number
  prefs?: TablePrefs
}

/** Ordena de la mesa que mejor calza (menos sillas vacías) a la que peor. */
function bySeatFit(partySize: number) {
  return (a: TableOption, b: TableOption) =>
    a.table.seats - partySize - (b.table.seats - partySize) ||
    a.table.label.localeCompare(b.table.label, 'es', { numeric: true })
}

export type TableSearchResult =
  | { ok: false; reason: string }
  | {
      ok: true
      /** Libres y con lo que pidió el cliente. */
      matches: TableOption[]
      /** Libres y con lugar, pero sin alguna de sus preferencias. */
      others: TableOption[]
    }

export function findTables(
  floors: Floor[],
  reservations: TableReservation[],
  hours: WeekHours,
  search: TableSearch,
  now?: LocalNow,
): TableSearchResult {
  const all = reservableTables(floors)
  if (all.length === 0) return { ok: false, reason: 'El local todavía no cargó sus mesas.' }

  const biggest = Math.max(...all.map((o) => o.table.seats))
  if (search.partySize > biggest) {
    return {
      ok: false,
      reason: `La mesa más grande es para ${biggest} personas. Para ${search.partySize} hay que juntar mesas: eso lo coordina una persona del equipo.`,
    }
  }

  const time = checkReservationTime(hours, search.date, search.time, now)
  if (!time.ok) return time

  const start = minutesOf(search.time)
  const free = all
    .filter((o) => o.table.seats >= search.partySize)
    .filter((o) => isTableFree(o.table.id, reservations, search.date, start, search.durationMinutes))
    .sort(bySeatFit(search.partySize))

  return {
    ok: true,
    matches: free.filter((o) => matchesPrefs(o, search.prefs)),
    others: free.filter((o) => !matchesPrefs(o, search.prefs)),
  }
}

/**
 * Otras horas del mismo día en que hay una mesa con lo que pidió el cliente,
 * de la más cercana a la que quería a la más lejana.
 */
export function suggestTimes(
  floors: Floor[],
  reservations: TableReservation[],
  hours: WeekHours,
  search: TableSearch,
  now?: LocalNow,
  limit = 4,
): string[] {
  const day = hours[weekdayOf(search.date)]
  if (!day) return []
  const wanted = minutesOf(search.time)
  const times: number[] = []
  for (let t = minutesOf(day.open); t <= minutesOf(day.close) - LAST_SEATING_MINUTES; t += STEP) {
    if (t !== wanted) times.push(t)
  }
  return times
    .sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted) || a - b)
    .filter((t) => {
      const result = findTables(floors, reservations, hours, { ...search, time: toTime(t) }, now)
      return result.ok && result.matches.length > 0
    })
    .slice(0, limit)
    .sort((a, b) => a - b)
    .map(toTime)
}

/**
 * Busca una mesa por el nombre con que la dijo el agente ("mesa 4", "M4").
 * Si hay dos con el mismo nombre en pisos distintos hace falta el piso.
 */
export function findTableByLabel(
  floors: Floor[],
  label: string,
  piso?: string,
): TableOption | 'ambigua' | null {
  const wanted = normalize(label)
  const bare = (text: string) => normalize(text).replace(/^mesa\s*/, '')
  let candidates = reservableTables(floors).filter(
    (o) => normalize(o.table.label) === wanted || bare(o.table.label) === bare(label),
  )
  if (piso) {
    candidates = candidates.filter((o) => normalize(o.floor.name).includes(normalize(piso)))
  }
  if (candidates.length === 0) return null
  if (candidates.length > 1) return 'ambigua'
  return candidates[0]
}

/** Resumen del local para el prompt del agente: qué hay en cada piso. */
export function summarizeFloors(floors: Floor[]): string {
  return floors
    .map((floor) => {
      const tables = reservableTables([floor])
      if (tables.length === 0) return null
      const seats = tables.map((t) => t.table.seats)
      const windows = floor.elements.filter((e) => e.kind === 'ventana')
      const windowLine = windows.length
        ? `${windows.length} ${windows.length === 1 ? 'ventana' : 'ventanas'} (${windows
            .map((w) => (w.sun ? `${w.label}, lado ${w.sun}` : w.label))
            .join('; ')}), ${tables.filter((t) => t.traits.window).length} mesas junto a ventana`
        : 'sin ventanas'
      const zones = [...new Set(tables.map((t) => t.traits.zone).filter(Boolean))]
      const sunCount = tables.filter((t) => t.traits.sun === 'sol').length
      const shadeCount = tables.filter((t) => t.traits.sun === 'sombra').length
      const sides = sunCount || shadeCount ? `; ${sunCount} al sol y ${shadeCount} a la sombra` : ''
      return `- ${floor.name}: ${tables.length} mesas de ${Math.min(...seats)} a ${Math.max(...seats)} personas; ${windowLine}${sides}${zones.length ? `; sectores: ${zones.join(', ')}` : ''}.`
    })
    .filter(Boolean)
    .join('\n')
}
