'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { addDays, formatDateLabel } from '@/lib/agenda'
import {
  describeTable,
  holdUntil,
  isTableFree,
  reservableTables,
  tableTraits,
  type ElementKind,
  type Floor,
  type FloorElement,
  type ReservationSettings,
  type TableReservation,
} from '@/lib/mesas'
import type { WeekHours } from '@/lib/types'
import FloorCanvas from './FloorCanvas'

const PRESETS: { label: string; kind: ElementKind; shape?: 'rect' | 'round'; width: number; height: number; seats?: number }[] = [
  { label: 'Mesa redonda', kind: 'mesa', shape: 'round', width: 70, height: 70, seats: 4 },
  { label: 'Mesa cuadrada', kind: 'mesa', shape: 'rect', width: 70, height: 70, seats: 4 },
  { label: 'Mesa larga', kind: 'mesa', shape: 'rect', width: 140, height: 70, seats: 6 },
  { label: 'Ventana', kind: 'ventana', width: 120, height: 12 },
  { label: 'Puerta', kind: 'puerta', width: 60, height: 12 },
  { label: 'Barra', kind: 'barra', width: 220, height: 50 },
  { label: 'Muro', kind: 'muro', width: 200, height: 12 },
  { label: 'Zona', kind: 'zona', width: 320, height: 220 },
]

const KIND_NAMES: Record<ElementKind, string> = {
  mesa: 'Mesa',
  ventana: 'Ventana',
  puerta: 'Puerta',
  barra: 'Barra',
  muro: 'Muro',
  zona: 'Zona',
}

const input =
  'w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none'
const btn = 'rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-800'
const primary = 'rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-amber-400 disabled:opacity-50'

/** El siguiente "Mesa 7" / "Ventana 3" libre del piso. */
function nextLabel(elements: FloorElement[], kind: ElementKind): string {
  const base = KIND_NAMES[kind]
  if (kind === 'puerta' || kind === 'barra' || kind === 'muro') return base
  const used = elements
    .filter((e) => e.kind === kind)
    .map((e) => Number(e.label.match(/(\d+)\s*$/)?.[1] ?? 0))
  return `${base} ${Math.max(0, ...used) + 1}`
}

function newElement(floor: Floor, preset: (typeof PRESETS)[number]): FloorElement {
  // Escalonado para que dos agregados seguidos no queden uno encima del otro.
  const offset = (floor.elements.length % 8) * 20
  return {
    id: crypto.randomUUID(),
    kind: preset.kind,
    label: nextLabel(floor.elements, preset.kind),
    x: Math.min(40 + offset, floor.width - preset.width),
    y: Math.min(40 + offset, floor.height - preset.height),
    width: preset.width,
    height: preset.height,
    shape: preset.shape ?? 'rect',
    seats: preset.seats ?? 0,
    sun: null,
    zone: '',
    nearWindow: null,
    reservable: preset.kind === 'mesa',
  }
}

function errorText(data: unknown, fallback: string): string {
  const error = (data as { error?: unknown } | null)?.error
  return typeof error === 'string' ? error : fallback
}

export default function MesasPage() {
  const { businessId } = useParams<{ businessId: string }>()
  const [tab, setTab] = useState<'croquis' | 'reservas'>('croquis')
  const [floors, setFloors] = useState<Floor[] | null>(null)
  const [reservations, setReservations] = useState<TableReservation[]>([])
  const [settings, setSettings] = useState<ReservationSettings>({ durationMinutes: 120, graceMinutes: 15 })
  const [hours, setHours] = useState<WeekHours>([])
  const [today, setToday] = useState('')
  const [nowTime, setNowTime] = useState('00:00')

  const load = useCallback(async () => {
    const res = await fetch(`/api/businesses/${businessId}/mesas`)
    if (!res.ok) return
    const data = await res.json()
    setFloors(data.floors)
    setReservations(data.reservations)
    setSettings(data.settings)
    setHours(data.hours)
    setToday(data.today)
    setNowTime(data.now)
  }, [businessId])

  useEffect(() => {
    load()
  }, [load])

  if (!floors) return <div className="px-8 py-12 text-gray-500">Cargando…</div>

  const tables = reservableTables(floors)

  return (
    <div className="mx-auto max-w-6xl px-8 py-12">
      <h1 className="text-2xl font-bold text-white">Mesas y reservas</h1>
      <p className="mt-2 max-w-2xl text-sm text-gray-400">
        Dibuja cada piso de tu local con sus mesas, ventanas y sectores. El agente usa este croquis para
        reservar por WhatsApp e Instagram y le cuenta al cliente dónde queda su mesa: junto a la ventana,
        al sol o a la sombra, en la terraza.
      </p>

      {tables.length === 0 && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-gray-300">
          Mientras no haya al menos una mesa guardada, el agente no toma reservas de mesa.
        </div>
      )}

      <div className="mt-6 flex gap-2 border-b border-gray-800">
        {(['croquis', 'reservas'] as const).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === id ? 'border-amber-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {id === 'croquis' ? 'Croquis del local' : `Reservas (${reservations.filter((r) => r.status === 'confirmado' && r.startsAt >= today).length})`}
          </button>
        ))}
      </div>

      {tab === 'croquis' ? (
        <FloorEditor businessId={businessId} floors={floors} onSaved={load} />
      ) : (
        <Reservations
          businessId={businessId}
          floors={floors}
          reservations={reservations}
          settings={settings}
          hours={hours}
          today={today}
          nowTime={nowTime}
          onChanged={load}
        />
      )}
    </div>
  )
}

function FloorEditor({
  businessId,
  floors,
  onSaved,
}: {
  businessId: string
  floors: Floor[]
  onSaved: () => Promise<void>
}) {
  const [floorId, setFloorId] = useState<string | null>(floors[0]?.id ?? null)
  const [draft, setDraft] = useState<Floor | null>(floors[0] ?? null)
  const [dirty, setDirty] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  // Al recargar desde el servidor (guardar, crear piso) se toma la versión nueva
  // del piso que se está editando, salvo que haya cambios sin guardar.
  useEffect(() => {
    if (dirty) return
    const current = floors.find((f) => f.id === floorId) ?? floors[0] ?? null
    setFloorId(current?.id ?? null)
    setDraft(current)
  }, [floors, floorId, dirty])

  function switchFloor(id: string) {
    if (dirty && !window.confirm('Hay cambios sin guardar en este piso. ¿Descartarlos?')) return
    setDirty(false)
    setSelectedId(null)
    setFloorId(id)
    setDraft(floors.find((f) => f.id === id) ?? null)
    setMessage(null)
  }

  function patchFloor(patch: Partial<Floor>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
    setDirty(true)
  }

  function patchElement(id: string, patch: Partial<FloorElement>) {
    setDraft((prev) =>
      prev ? { ...prev, elements: prev.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) } : prev,
    )
    setDirty(true)
  }

  function add(preset: (typeof PRESETS)[number]) {
    if (!draft) return
    const el = newElement(draft, preset)
    setDraft({ ...draft, elements: [...draft.elements, el] })
    setSelectedId(el.id)
    setDirty(true)
  }

  function remove(id: string) {
    if (!draft) return
    setDraft({ ...draft, elements: draft.elements.filter((e) => e.id !== id) })
    setSelectedId(null)
    setDirty(true)
  }

  function duplicate(el: FloorElement) {
    if (!draft) return
    const copy = {
      ...el,
      id: crypto.randomUUID(),
      label: el.kind === 'mesa' || el.kind === 'ventana' ? nextLabel(draft.elements, el.kind) : el.label,
      x: Math.min(el.x + 20, draft.width - el.width),
      y: Math.min(el.y + 20, draft.height - el.height),
    }
    setDraft({ ...draft, elements: [...draft.elements, copy] })
    setSelectedId(copy.id)
    setDirty(true)
  }

  async function addFloor() {
    const name = window.prompt('Nombre del piso o salón', floors.length === 0 ? 'Primer piso' : `Piso ${floors.length + 1}`)
    if (!name?.trim()) return
    if (dirty && !window.confirm('Hay cambios sin guardar en este piso. ¿Descartarlos?')) return
    const res = await fetch(`/api/businesses/${businessId}/mesas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setMessage({ ok: false, text: errorText(data, 'No se pudo crear el piso.') })
      return
    }
    setDirty(false)
    setSelectedId(null)
    // Primero recargar y después elegirlo: si no, el efecto de arriba no lo
    // encuentra todavía en la lista y vuelve al primer piso.
    await onSaved()
    setFloorId(data.floor.id)
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    setMessage(null)
    const res = await fetch(`/api/floors/${draft.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: draft.name, width: draft.width, height: draft.height, elements: draft.elements }),
    })
    const data = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok) {
      setMessage({ ok: false, text: errorText(data, 'No se pudo guardar el croquis.') })
      return
    }
    setDirty(false)
    setMessage({ ok: true, text: 'Croquis guardado. El agente ya lo usa.' })
    await onSaved()
  }

  async function removeFloor() {
    if (!draft) return
    if (!window.confirm(`¿Eliminar "${draft.name}" con todo su croquis? Las reservas ya tomadas se conservan.`)) return
    await fetch(`/api/floors/${draft.id}`, { method: 'DELETE' })
    setDirty(false)
    setSelectedId(null)
    setFloorId(floors.find((f) => f.id !== draft.id)?.id ?? null)
    await onSaved()
  }

  // Del borrador del piso actual más lo guardado de los otros: la búsqueda del
  // agente mira todos los pisos y el resumen tiene que coincidir con lo que ve.
  const stats = useMemo(() => {
    if (!draft) return null
    const tables = reservableTables([draft])
    return {
      tables: tables.length,
      seats: tables.reduce((sum, t) => sum + t.table.seats, 0),
      windows: draft.elements.filter((e) => e.kind === 'ventana').length,
      byWindow: tables.filter((t) => t.traits.window).length,
      sol: tables.filter((t) => t.traits.sun === 'sol').length,
      sombra: tables.filter((t) => t.traits.sun === 'sombra').length,
    }
  }, [draft])

  const selected = draft?.elements.find((e) => e.id === selectedId) ?? null

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        {floors.map((f) => (
          <button
            key={f.id}
            onClick={() => switchFloor(f.id)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              f.id === floorId ? 'bg-amber-500 font-semibold text-gray-950' : 'border border-gray-700 text-gray-300 hover:bg-gray-800'
            }`}
          >
            {f.id === floorId && draft ? draft.name : f.name}
          </button>
        ))}
        <button onClick={addFloor} className={btn}>
          + Agregar piso
        </button>
      </div>

      {!draft ? (
        <div className="mt-6 rounded-lg border border-dashed border-gray-700 p-10 text-center text-sm text-gray-400">
          Empieza agregando el primer piso o salón de tu local.
        </div>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.label} onClick={() => add(p)} className={btn}>
                  + {p.label}
                </button>
              ))}
            </div>
            <FloorCanvas floor={draft} selectedId={selectedId} onSelect={setSelectedId} onChange={patchElement} />
            <p className="mt-2 text-xs text-gray-500">
              Arrastra para mover; el cuadradito amarillo de la esquina cambia el tamaño. Una mesa pegada a una
              ventana queda como &quot;de ventana&quot; y toma su lado (sol o sombra); una mesa dentro de una zona
              queda en ese sector. Punto celeste = mesa de ventana.
            </p>
            {stats && (
              <p className="mt-3 text-sm text-gray-300">
                {stats.tables} mesas · {stats.seats} personas · {stats.windows} ventanas · {stats.byWindow} mesas de
                ventana · {stats.sol} al sol · {stats.sombra} a la sombra
              </p>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-gray-800 p-4">
              {selected ? (
                <ElementProperties
                  floor={draft}
                  el={selected}
                  onChange={(patch) => patchElement(selected.id, patch)}
                  onDuplicate={() => duplicate(selected)}
                  onRemove={() => remove(selected.id)}
                />
              ) : (
                <FloorProperties floor={draft} onChange={patchFloor} onRemove={removeFloor} />
              )}
            </div>

            <button onClick={save} disabled={saving || !dirty} className={`${primary} w-full`}>
              {saving ? 'Guardando…' : dirty ? 'Guardar croquis' : 'Sin cambios'}
            </button>
            {message && (
              <p className={`text-sm ${message.ok ? 'text-emerald-400' : 'text-red-400'}`}>{message.text}</p>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-gray-400">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  )
}

function FloorProperties({
  floor,
  onChange,
  onRemove,
}: {
  floor: Floor
  onChange: (patch: Partial<Floor>) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white">Piso</h3>
      <Field label="Nombre">
        <input className={input} value={floor.name} maxLength={60} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Ancho del lienzo">
          <input
            type="number"
            className={input}
            value={floor.width}
            min={200}
            max={4000}
            step={50}
            onChange={(e) => onChange({ width: Number(e.target.value) })}
          />
        </Field>
        <Field label="Alto del lienzo">
          <input
            type="number"
            className={input}
            value={floor.height}
            min={200}
            max={4000}
            step={50}
            onChange={(e) => onChange({ height: Number(e.target.value) })}
          />
        </Field>
      </div>
      <p className="text-xs text-gray-500">Toca un elemento del dibujo para editarlo.</p>
      <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-300">
        Eliminar este piso
      </button>
    </div>
  )
}

function ElementProperties({
  floor,
  el,
  onChange,
  onDuplicate,
  onRemove,
}: {
  floor: Floor
  el: FloorElement
  onChange: (patch: Partial<FloorElement>) => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const traits = el.kind === 'mesa' ? tableTraits(floor, el) : null
  const sunValue = el.sun ?? ''

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white">{KIND_NAMES[el.kind]}</h3>
      <Field label={el.kind === 'mesa' ? 'Nombre de la mesa (lo usa el agente)' : 'Nombre'}>
        <input className={input} value={el.label} maxLength={40} onChange={(e) => onChange({ label: e.target.value })} />
      </Field>

      {el.kind === 'mesa' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Personas">
              <input
                type="number"
                className={input}
                value={el.seats}
                min={1}
                max={40}
                onChange={(e) => onChange({ seats: Math.max(1, Math.min(40, Number(e.target.value) || 1)) })}
              />
            </Field>
            <Field label="Forma">
              <select
                className={input}
                value={el.shape}
                onChange={(e) => onChange({ shape: e.target.value as 'rect' | 'round' })}
              >
                <option value="round">Redonda</option>
                <option value="rect">Cuadrada / larga</option>
              </select>
            </Field>
          </div>
          <Field label="Junto a ventana">
            <select
              className={input}
              value={el.nearWindow === null ? 'auto' : el.nearWindow ? 'si' : 'no'}
              onChange={(e) =>
                onChange({ nearWindow: e.target.value === 'auto' ? null : e.target.value === 'si' })
              }
            >
              <option value="auto">Automático (según el dibujo)</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Lado">
            <select
              className={input}
              value={sunValue}
              onChange={(e) => onChange({ sun: (e.target.value || null) as FloorElement['sun'] })}
            >
              <option value="">Automático (el de su ventana o zona)</option>
              <option value="sol">Sol</option>
              <option value="sombra">Sombra</option>
            </select>
          </Field>
          <Field label="Sector (vacío = el de la zona dibujada)">
            <input
              className={input}
              value={el.zone}
              maxLength={40}
              placeholder="Terraza, Salón, Privado…"
              onChange={(e) => onChange({ zone: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={el.reservable} onChange={(e) => onChange({ reservable: e.target.checked })} />
            Se puede reservar
          </label>
          {traits && (
            <p className="rounded-md bg-gray-900 p-2 text-xs text-gray-300">
              El agente la describe así:{' '}
              <span className="text-white">
                {describeTable({ floor, table: el, traits })}
              </span>
            </p>
          )}
        </>
      )}

      {(el.kind === 'ventana' || el.kind === 'zona') && (
        <Field label={el.kind === 'ventana' ? 'Lado de esta ventana' : 'Lado de esta zona'}>
          <select
            className={input}
            value={sunValue}
            onChange={(e) => onChange({ sun: (e.target.value || null) as FloorElement['sun'] })}
          >
            <option value="">Sin indicar</option>
            <option value="sol">Sol</option>
            <option value="sombra">Sombra</option>
          </select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Ancho">
          <input
            type="number"
            className={input}
            value={el.width}
            min={10}
            step={10}
            onChange={(e) => onChange({ width: Math.max(10, Number(e.target.value) || 10) })}
          />
        </Field>
        <Field label="Alto">
          <input
            type="number"
            className={input}
            value={el.height}
            min={10}
            step={10}
            onChange={(e) => onChange({ height: Math.max(10, Number(e.target.value) || 10) })}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button className={btn} onClick={() => onChange({ width: el.height, height: el.width })}>
          Girar
        </button>
        <button className={btn} onClick={onDuplicate}>
          Duplicar
        </button>
        <button className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10" onClick={onRemove}>
          Eliminar
        </button>
      </div>
    </div>
  )
}

function Reservations({
  businessId,
  floors,
  reservations,
  settings,
  hours,
  today,
  nowTime,
  onChanged,
}: {
  businessId: string
  floors: Floor[]
  reservations: TableReservation[]
  settings: ReservationSettings
  hours: WeekHours
  today: string
  /** Hora local del negocio al cargar: para saber qué reservas ya pasaron su hora. */
  nowTime: string
  onChanged: () => Promise<void>
}) {
  const [date, setDate] = useState(today)
  const [time, setTime] = useState(() => hours.find(Boolean)?.open ?? '20:00')
  const [floorId, setFloorId] = useState(floors[0]?.id ?? '')
  const [minutes, setMinutes] = useState(String(settings.durationMinutes))
  const [grace, setGrace] = useState(String(settings.graceMinutes))
  const [form, setForm] = useState({ tableId: '', partySize: '2', contactName: '', contactHandle: '', note: '' })
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const tables = reservableTables(floors)
  const ofDay = reservations.filter((r) => r.startsAt.startsWith(date))
  const [h, m] = time.split(':').map(Number)
  const occupied = new Set(
    tables
      .filter((o) => !isTableFree(o.table.id, reservations, date, h * 60 + m, 1))
      .map((o) => o.table.id),
  )
  const floor = floors.find((f) => f.id === floorId) ?? floors[0]

  async function saveMinutes() {
    const res = await fetch(`/api/businesses/${businessId}/mesas`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationMinutes: Number(minutes), graceMinutes: Number(grace) }),
    })
    const data = await res.json().catch(() => null)
    setMessage(res.ok ? { ok: true, text: 'Guardado.' } : { ok: false, text: errorText(data, 'No se pudo guardar.') })
    if (res.ok) await onChanged()
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    const res = await fetch(`/api/businesses/${businessId}/reservas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, partySize: Number(form.partySize), date, time }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setMessage({ ok: false, text: errorText(data, 'No se pudo reservar.') })
      return
    }
    setForm({ tableId: '', partySize: '2', contactName: '', contactHandle: '', note: '' })
    setMessage({ ok: true, text: 'Reserva anotada.' })
    await onChanged()
  }

  async function cancel(id: string) {
    if (!window.confirm('¿Cancelar esta reserva?')) return
    await fetch(`/api/reservas/${id}`, { method: 'DELETE' })
    await onChanged()
  }

  async function noShow(id: string) {
    if (!window.confirm('¿Marcar que no llegó? La mesa queda libre para otra reserva.')) return
    await fetch(`/api/reservas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'no_llego' }),
    })
    await onChanged()
  }

  /** Ya pasó la tolerancia de una reserva: el local puede liberar la mesa. */
  function pastGrace(r: TableReservation): boolean {
    const [d, t] = r.startsAt.split('T')
    const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
    const end = toMinutes(t) + settings.graceMinutes
    if (d === today) return toMinutes(nowTime) >= end
    // Una reserva de anoche cuya tolerancia cruza la medianoche.
    if (d === addDays(today, -1)) return toMinutes(nowTime) + 24 * 60 >= end
    return d < today
  }

  if (tables.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-gray-700 p-10 text-center text-sm text-gray-400">
        Primero dibuja tus mesas en la pestaña &quot;Croquis del local&quot; y guárdalas.
      </div>
    )
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Día">
            <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Ver ocupación a las">
            <input type="time" className={input} value={time} step={1800} onChange={(e) => setTime(e.target.value || '20:00')} />
          </Field>
          {floors.length > 1 && (
            <Field label="Piso">
              <select className={input} value={floor?.id} onChange={(e) => setFloorId(e.target.value)}>
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        {floor && (
          <div className="mt-4">
            <FloorCanvas floor={floor} occupiedIds={occupied} />
            <p className="mt-2 text-xs text-gray-500">
              En rojo, las mesas ocupadas el {date ? formatDateLabel(date) : ''} a las {time}.
            </p>
          </div>
        )}

        <h3 className="mt-8 text-sm font-semibold text-white">
          Reservas del {date ? formatDateLabel(date) : ''} ({ofDay.filter((r) => r.status === 'confirmado').length})
        </h3>
        {ofDay.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No hay reservas ese día.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-800 rounded-lg border border-gray-800">
            {ofDay.map((r) => (
              <li key={r.id} className={`flex items-start justify-between gap-4 p-4 ${r.status !== 'confirmado' ? 'opacity-50' : ''}`}>
                <div className="text-sm">
                  <p className="font-medium text-white">
                    {r.startsAt.slice(11, 16)} · {r.tableLabel} ({r.floorName}) · {r.partySize} personas
                  </p>
                  <p className="text-gray-400">
                    {r.contactName}
                    {r.contactHandle ? ` · ${r.contactHandle}` : ''}
                    {r.conversationId ? ' · reservó el agente' : ' · anotada a mano'}
                    {r.status === 'cancelado' ? ' · cancelada' : ''}
                    {r.status === 'no_llego' ? ' · no llegó (mesa liberada)' : ''}
                  </p>
                  {r.status === 'confirmado' && (
                    <p className="text-xs text-amber-400/80">
                      Se le guarda hasta las {holdUntil(r.startsAt.slice(11, 16), settings.graceMinutes)}
                    </p>
                  )}
                  {r.note && <p className="text-gray-500">{r.note}</p>}
                </div>
                {r.status === 'confirmado' && (
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {pastGrace(r) && (
                      <button onClick={() => noShow(r.id)} className="text-xs text-amber-400 hover:text-amber-300">
                        No llegó · liberar mesa
                      </button>
                    )}
                    <button onClick={() => cancel(r.id)} className="text-xs text-red-400 hover:text-red-300">
                      Cancelar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="space-y-4">
        <form onSubmit={create} className="space-y-3 rounded-lg border border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-white">Anotar reserva a mano</h3>
          <p className="text-xs text-gray-500">
            Para las que llegan por teléfono o en persona. Usa el día y la hora de arriba.
          </p>
          <Field label="Mesa">
            <select
              className={input}
              required
              value={form.tableId}
              onChange={(e) => setForm({ ...form, tableId: e.target.value })}
            >
              <option value="">Elige una mesa</option>
              {tables.map((o) => (
                <option key={o.table.id} value={o.table.id} disabled={occupied.has(o.table.id)}>
                  {describeTable(o)}
                  {occupied.has(o.table.id) ? ' — ocupada' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Personas">
            <input
              type="number"
              className={input}
              min={1}
              max={100}
              required
              value={form.partySize}
              onChange={(e) => setForm({ ...form, partySize: e.target.value })}
            />
          </Field>
          <Field label="Nombre">
            <input className={input} required maxLength={80} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          </Field>
          <Field label="Teléfono (opcional)">
            <input className={input} maxLength={40} value={form.contactHandle} onChange={(e) => setForm({ ...form, contactHandle: e.target.value })} />
          </Field>
          <Field label="Nota (opcional)">
            <input className={input} maxLength={300} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <button type="submit" className={`${primary} w-full`}>
            Reservar
          </button>
        </form>

        <div className="space-y-2 rounded-lg border border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-white">Duración y tolerancia</h3>
          <Field label="Cuánto queda tomada la mesa (minutos)">
            <input type="number" className={input} min={30} max={480} step={15} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </Field>
          <Field label="Cuánto se espera al cliente (minutos)">
            <input type="number" className={input} min={0} max={120} step={5} value={grace} onChange={(e) => setGrace(e.target.value)} />
          </Field>
          <p className="text-xs text-gray-500">
            El agente avisa al confirmar que la mesa se guarda hasta esos minutos después de la hora. Pasado ese
            tiempo, aquí puedes marcar &quot;No llegó&quot; y la mesa queda libre.
          </p>
          <button type="button" onClick={saveMinutes} className={btn}>
            Guardar
          </button>
        </div>
        {message && <p className={`text-sm ${message.ok ? 'text-emerald-400' : 'text-red-400'}`}>{message.text}</p>}
      </aside>
    </div>
  )
}
