'use client'

import { useRef } from 'react'
import { tableTraits, type Floor, type FloorElement } from '@/lib/mesas'

/** Al mover o agrandar, todo cae en múltiplos de esto: así las mesas quedan alineadas. */
export const SNAP = 10
const MIN_SIZE = 10

const snap = (n: number) => Math.round(n / SNAP) * SNAP

type Drag =
  | { mode: 'move'; id: string; dx: number; dy: number }
  | { mode: 'resize'; id: string; x: number; y: number }

const SUN_FILL = { sol: '#f59e0b', sombra: '#6366f1' } as const

function tableColors(floor: Floor, el: FloorElement, occupied: boolean) {
  if (occupied) return { fill: 'rgba(239,68,68,0.28)', stroke: '#ef4444' }
  if (!el.reservable) return { fill: 'rgba(107,114,128,0.18)', stroke: '#6b7280' }
  const sun = tableTraits(floor, el).sun
  return sun
    ? { fill: `${SUN_FILL[sun]}33`, stroke: SUN_FILL[sun] }
    : { fill: 'rgba(16,185,129,0.18)', stroke: '#10b981' }
}

function ElementShape({
  floor,
  el,
  selected,
  occupied,
}: {
  floor: Floor
  el: FloorElement
  selected: boolean
  occupied: boolean
}) {
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  const ring = selected ? { stroke: '#fbbf24', strokeWidth: 3 } : null
  const fontSize = Math.max(9, Math.min(16, Math.min(el.width, el.height) / 3.2))

  if (el.kind === 'zona') {
    const tint = el.sun ? SUN_FILL[el.sun] : '#94a3b8'
    return (
      <g>
        <rect
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          rx={8}
          fill={`${tint}14`}
          stroke={ring?.stroke ?? `${tint}88`}
          strokeWidth={ring?.strokeWidth ?? 1.5}
          strokeDasharray="8 6"
        />
        <text x={el.x + 10} y={el.y + 20} fontSize={14} fill={`${tint}`} fontWeight={600}>
          {el.label || 'Zona'}
          {el.sun ? ` · ${el.sun}` : ''}
        </text>
      </g>
    )
  }

  if (el.kind === 'mesa') {
    const colors = tableColors(floor, el, occupied)
    const traits = tableTraits(floor, el)
    const shape =
      el.shape === 'round' ? (
        <ellipse
          cx={cx}
          cy={cy}
          rx={el.width / 2}
          ry={el.height / 2}
          fill={colors.fill}
          stroke={ring?.stroke ?? colors.stroke}
          strokeWidth={ring?.strokeWidth ?? 2}
        />
      ) : (
        <rect
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          rx={6}
          fill={colors.fill}
          stroke={ring?.stroke ?? colors.stroke}
          strokeWidth={ring?.strokeWidth ?? 2}
        />
      )
    return (
      <g>
        {shape}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={fontSize} fill="#f3f4f6" fontWeight={600}>
          {el.label}
        </text>
        <text x={cx} y={cy + fontSize} textAnchor="middle" fontSize={fontSize * 0.8} fill="#d1d5db">
          {el.seats} p
        </text>
        {traits.window && <circle cx={el.x + el.width - 4} cy={el.y + 4} r={5} fill="#38bdf8" />}
      </g>
    )
  }

  const styles: Record<string, { fill: string; stroke: string; text: string }> = {
    ventana: { fill: 'rgba(56,189,248,0.35)', stroke: el.sun ? SUN_FILL[el.sun] : '#38bdf8', text: '#e0f2fe' },
    puerta: { fill: 'rgba(52,211,153,0.25)', stroke: '#34d399', text: '#d1fae5' },
    barra: { fill: 'rgba(180,83,9,0.45)', stroke: '#b45309', text: '#fde68a' },
    muro: { fill: '#4b5563', stroke: '#374151', text: '#e5e7eb' },
  }
  const style = styles[el.kind]
  const vertical = el.height > el.width
  return (
    <g>
      <rect
        x={el.x}
        y={el.y}
        width={el.width}
        height={el.height}
        rx={2}
        fill={style.fill}
        stroke={ring?.stroke ?? style.stroke}
        strokeWidth={ring?.strokeWidth ?? (el.kind === 'ventana' ? 2.5 : 1.5)}
      />
      {el.label && (el.kind !== 'muro' || el.width > 60 || el.height > 60) && (
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize={11}
          fill={style.text}
          transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined}
        >
          {el.label}
          {el.kind === 'ventana' && el.sun ? ` (${el.sun})` : ''}
        </text>
      )}
    </g>
  )
}

/**
 * Dibuja un piso. Con `onChange` se puede mover y agrandar lo que hay; sin él
 * es solo para mirar (la vista de reservas, que pinta de rojo las ocupadas).
 */
export default function FloorCanvas({
  floor,
  selectedId = null,
  occupiedIds,
  onSelect,
  onChange,
}: {
  floor: Floor
  selectedId?: string | null
  occupiedIds?: Set<string>
  onSelect?: (id: string | null) => void
  onChange?: (id: string, patch: Partial<FloorElement>) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const editable = Boolean(onChange)

  function point(event: React.PointerEvent): { x: number; y: number } {
    const svg = svgRef.current
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return { x: 0, y: 0 }
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return { x: p.x, y: p.y }
  }

  function startMove(event: React.PointerEvent, el: FloorElement) {
    event.stopPropagation()
    onSelect?.(el.id)
    if (!editable) return
    const p = point(event)
    drag.current = { mode: 'move', id: el.id, dx: p.x - el.x, dy: p.y - el.y }
    svgRef.current?.setPointerCapture(event.pointerId)
  }

  function startResize(event: React.PointerEvent, el: FloorElement) {
    event.stopPropagation()
    drag.current = { mode: 'resize', id: el.id, x: el.x, y: el.y }
    svgRef.current?.setPointerCapture(event.pointerId)
  }

  function move(event: React.PointerEvent) {
    const current = drag.current
    if (!current || !onChange) return
    const p = point(event)
    const el = floor.elements.find((e) => e.id === current.id)
    if (!el) return
    if (current.mode === 'move') {
      const x = Math.min(Math.max(snap(p.x - current.dx), 0), floor.width - el.width)
      const y = Math.min(Math.max(snap(p.y - current.dy), 0), floor.height - el.height)
      if (x !== el.x || y !== el.y) onChange(el.id, { x, y })
    } else {
      const width = Math.min(Math.max(snap(p.x - current.x), MIN_SIZE), floor.width - current.x)
      const height = Math.min(Math.max(snap(p.y - current.y), MIN_SIZE), floor.height - current.y)
      if (width !== el.width || height !== el.height) onChange(el.id, { width, height })
    }
  }

  function end(event: React.PointerEvent) {
    if (drag.current) svgRef.current?.releasePointerCapture(event.pointerId)
    drag.current = null
  }

  // Las zonas van abajo de todo: si no, taparían las mesas que contienen.
  const ordered = [...floor.elements].sort(
    (a, b) => Number(b.kind === 'zona') - Number(a.kind === 'zona'),
  )
  const selected = floor.elements.find((e) => e.id === selectedId)

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${floor.width} ${floor.height}`}
      className="h-auto w-full touch-none select-none rounded-lg border border-gray-800 bg-gray-950"
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerDown={() => onSelect?.(null)}
      role="img"
      aria-label={`Croquis de ${floor.name}`}
    >
      <defs>
        <pattern id={`grid-${floor.id}`} width={50} height={50} patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#1f2937" strokeWidth={1} />
        </pattern>
      </defs>
      <rect width={floor.width} height={floor.height} fill={`url(#grid-${floor.id})`} />
      {ordered.map((el) => (
        <g
          key={el.id}
          onPointerDown={(event) => startMove(event, el)}
          className={editable ? 'cursor-move' : onSelect ? 'cursor-pointer' : undefined}
        >
          <ElementShape
            floor={floor}
            el={el}
            selected={el.id === selectedId}
            occupied={occupiedIds?.has(el.id) ?? false}
          />
        </g>
      ))}
      {editable && selected && (
        <rect
          x={selected.x + selected.width - 7}
          y={selected.y + selected.height - 7}
          width={14}
          height={14}
          rx={3}
          fill="#fbbf24"
          className="cursor-nwse-resize"
          onPointerDown={(event) => startResize(event, selected)}
        >
          <title>Arrastra para cambiar el tamaño</title>
        </rect>
      )}
    </svg>
  )
}
