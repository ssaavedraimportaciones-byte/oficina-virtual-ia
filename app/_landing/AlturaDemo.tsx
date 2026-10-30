'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AlturaScene, AlturaView } from './altura/scene'
import { CHOSEN, FACING_TEXT, PLACE, TABLES } from './altura/plan'

/**
 * El ejemplo de reservas: Altura Bistró en 3D (la cámara gira alrededor del
 * edificio y entra a la mesa elegida), el croquis del salón y el chat.
 *
 * Sin movimiento (prefers-reduced-motion) la escena queda quieta y cambia de
 * toma sin animación. Si el equipo no tiene WebGL queda el croquis, que es lo
 * que explica la función.
 */

const HOLD = PLACE.graceMinutes

const CHAT = [
  { from: 'in', text: 'Hola! ¿tienen mesa para 4 el sábado a las 20:30? Ojalá con vista a la Torre Titanium 🙏' },
  {
    from: 'out',
    text: '¡Hola! Sí 🙌 Te dejo la Mesa 3 del piso 11, junto al ventanal con vista a la Torre Titanium. A esa hora te toca el atardecer de frente. ¿A nombre de quién la reservo?',
  },
  { from: 'in', text: 'A nombre de Camila' },
  {
    from: 'out',
    text: `Listo, Camila: sábado 20:30, 4 personas, Mesa 3 frente a la Torre Titanium. Te la guardamos hasta las 20:45 (${HOLD} minutos de tolerancia); si no alcanzas a llegar, se libera para otros clientes. ¡Te esperamos!`,
  },
] as const

/** Recorrido automático mientras nadie toca nada: girar, sentarse a la mesa del chat, girar, subir a la terraza. */
const TOUR: { view: AlturaView; seconds: number }[] = [
  { view: { kind: 'orbit' }, seconds: 10 },
  { view: { kind: 'table', label: CHOSEN }, seconds: 8 },
  { view: { kind: 'orbit' }, seconds: 9 },
  { view: { kind: 'terrace' }, seconds: 7 },
]

function caption(view: AlturaView): { title: string; sub: string } {
  if (view.kind === 'table') {
    const t = TABLES.find((x) => x.label === view.label)!
    return {
      title: `Mesa ${t.label} · ${t.seats} personas`,
      sub:
        t.label === CHOSEN
          ? `${FACING_TEXT[t.facing]} · reservada para Camila, sábado 20:30`
          : t.tone === 'tomada'
            ? `${FACING_TEXT[t.facing]} · ocupada a esa hora`
            : FACING_TEXT[t.facing],
    }
  }
  if (view.kind === 'terrace') return { title: 'Terraza Mirador · piso 12', sub: 'al aire libre, frente a la Torre Titanium' }
  return { title: `${PLACE.name} · pisos 11 y 12`, sub: 'la cámara gira alrededor del edificio' }
}

const sameView = (a: AlturaView, b: AlturaView) =>
  a.kind === b.kind && (a.kind !== 'table' || (b.kind === 'table' && a.label === b.label))

export default function AlturaDemo() {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<AlturaScene | null>(null)
  const [view, setViewState] = useState<AlturaView>({ kind: 'orbit' })
  const [state, setState] = useState<'idle' | 'ready' | 'error'>('idle')
  const [touched, setTouched] = useState(false)

  const applyView = useCallback((v: AlturaView) => {
    setViewState(v)
    sceneRef.current?.setView(v)
  }, [])

  const choose = (v: AlturaView) => {
    setTouched(true)
    applyView(v)
  }

  // La escena se crea recién cuando la sección se acerca a la pantalla, y solo dibuja mientras se ve.
  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas) return
    let disposed = false
    let starting = false
    const motion = document.documentElement.classList.contains('js-motion')
    const lite = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches

    const observer = new IntersectionObserver(
      ([entry]) => {
        const scene = sceneRef.current
        if (scene) {
          scene.setVisible(entry.isIntersecting && document.visibilityState === 'visible')
          return
        }
        if (!entry.isIntersecting || starting) return
        starting = true
        import('./altura/scene')
          .then(({ createAlturaScene }) => {
            if (disposed) return
            const created = createAlturaScene(canvas, { motion, lite })
            sceneRef.current = created
            created.setVisible(true)
            setState('ready')
          })
          .catch((error) => {
            console.warn('[landing] no se pudo iniciar la escena de Altura:', error)
            setState('error')
          })
      },
      { rootMargin: '200px 0px' },
    )
    observer.observe(stage)
    const onVisibility = () => sceneRef.current?.setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      disposed = true
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [])

  // Recorrido automático hasta que alguien elige una toma.
  useEffect(() => {
    if (state !== 'ready' || touched) return
    if (!document.documentElement.classList.contains('js-motion')) return
    let step = 0
    let timer: ReturnType<typeof setTimeout>
    const next = () => {
      step = (step + 1) % TOUR.length
      applyView(TOUR[step].view)
      timer = setTimeout(next, TOUR[step].seconds * 1000)
    }
    timer = setTimeout(next, TOUR[0].seconds * 1000)
    return () => clearTimeout(timer)
  }, [state, touched, applyView])

  const selected = view.kind === 'table' ? view.label : null
  const text = caption(view)

  return (
    <div className="zv-mesas-demo">
      <div className="zv-altura" ref={stageRef} data-state={state}>
        <canvas ref={canvasRef} className="zv-altura-canvas" aria-hidden="true" />
        <div className="zv-altura-cap" aria-live="polite">
          <strong>{text.title}</strong>
          <span>{text.sub}</span>
        </div>
        <p className="zv-altura-hold">
          ⏱ Se guarda {HOLD} min después de la hora. Si no llega, la mesa se libera.
        </p>
        <div className="zv-altura-chips" role="group" aria-label="Elegir vista">
          {(
            [
              { v: { kind: 'orbit' }, l: 'Girar alrededor' },
              { v: { kind: 'table', label: CHOSEN }, l: 'Mesa 3 · Torre Titanium' },
              { v: { kind: 'table', label: '5' }, l: 'Mesa 5 · Cordillera' },
              { v: { kind: 'terrace' }, l: 'Terraza' },
            ] as { v: AlturaView; l: string }[]
          ).map((c) => (
            <button
              key={c.l}
              type="button"
              aria-pressed={sameView(view, c.v)}
              onClick={() => choose(c.v)}
              disabled={state === 'error'}
            >
              {c.l}
            </button>
          ))}
        </div>
        {state === 'error' && <p className="zv-altura-fallback">Tu navegador no muestra 3D: mira el croquis de abajo.</p>}
      </div>

      <figure className="zv-mesas-card">
        <p className="zv-mesas-place">
          <strong>{PLACE.name}</strong> · {PLACE.floor} · {PLACE.where}
          <span>toca una mesa</span>
        </p>
        <svg
          className="zv-mesas-plan"
          viewBox="0 0 400 300"
          role="group"
          aria-label="Croquis de ejemplo de Altura Bistró: un ventanal al sol con vista a la Torre Titanium, otro a la sombra hacia la cordillera. Toca una mesa para ver su vista."
        >
          <defs>
            <pattern id="zv-mesas-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(239,231,216,0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="1" y="1" width="398" height="298" rx="14" className="zv-mesas-floor" />
          <rect x="1" y="1" width="398" height="298" rx="14" fill="url(#zv-mesas-grid)" />
          <rect x="30" y="6" width="200" height="8" rx="3" className="zv-mesas-win zv-mesas-win--sol" />
          <text x="130" y="30" className="zv-mesas-tag">ventanal torre titanium · sol</text>
          <rect x="386" y="50" width="8" height="150" rx="3" className="zv-mesas-win zv-mesas-win--sombra" />
          <text x="330" y="40" className="zv-mesas-tag">cordillera · sombra</text>
          <rect x="24" y="236" width="150" height="40" rx="4" className="zv-mesas-bar" />
          <text x="99" y="260" className="zv-mesas-tag">barra de cócteles</text>
          <rect x="250" y="288" width="70" height="6" rx="2" className="zv-mesas-door" />
          {TABLES.map((t) => {
            const isSelected = selected === t.label
            const v: AlturaView = { kind: 'table', label: t.label }
            return (
              <g
                key={t.label}
                className={`zv-mesas-t zv-mesas-t--${t.tone}${isSelected ? ' is-chosen' : ''}`}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`Mesa ${t.label}, ${t.seats} personas, ${FACING_TEXT[t.facing]}`}
                onClick={() => choose(v)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    choose(v)
                  }
                }}
              >
                {isSelected &&
                  (t.r ? (
                    <circle cx={t.x} cy={t.y} r={t.r + 8} className="zv-mesas-ring" />
                  ) : (
                    <rect x={t.x - 8} y={t.y - 8} width={(t.w ?? 0) + 16} height={(t.h ?? 0) + 16} rx="12" className="zv-mesas-ring" />
                  ))}
                {t.r ? <circle cx={t.x} cy={t.y} r={t.r} /> : <rect x={t.x} y={t.y} width={t.w} height={t.h} rx="7" />}
                <text x={t.r ? t.x : t.x + (t.w ?? 0) / 2} y={(t.r ? t.y : t.y + (t.h ?? 0) / 2) + 4}>
                  {t.label}
                </text>
              </g>
            )
          })}
        </svg>
        <figcaption className="zv-mesas-legend">
          <span className="is-sol">Sol</span>
          <span className="is-sombra">Sombra</span>
          <span className="is-libre">Libre</span>
          <span className="is-tomada">Reservada</span>
        </figcaption>
      </figure>

      <div className="zv-mesas-chat" aria-label="Conversación de ejemplo">
        {CHAT.map((m, i) => (
          <p key={i} className={`zv-mesas-msg zv-mesas-msg--${m.from}`}>
            {m.text}
          </p>
        ))}
      </div>
    </div>
  )
}
