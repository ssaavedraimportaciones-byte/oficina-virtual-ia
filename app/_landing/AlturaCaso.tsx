'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AlturaScene, AlturaView } from './altura/scene'
import { CHOSEN, FACING_TEXT, PLACE, TABLES } from './altura/plan'
import { CasoPhone, CasoSteps } from './CasoParts'
import type { Caso } from './data'

/**
 * El ejemplo de reservas, actuado como los otros ejemplos: el chat avanza con
 * el scroll (lo anima motion.ts, igual que el food truck y la clínica) y la
 * escena 3D de Altura Bistró lo sigue:
 *
 *   - mientras la clienta pregunta, la cámara gira alrededor del edificio;
 *   - cuando el agente ofrece la Mesa 3, entra al salón y se sienta en ella;
 *   - al confirmar, la mesa queda marcada como reservada;
 *   - con el aviso de los 15 minutos, se destaca la tolerancia.
 *
 * Si alguien toca una mesa o un botón, la escena le hace caso y deja de seguir
 * el chat hasta que la conversación se vuelve a reproducir.
 */

/** Cuántos mensajes tienen que estar a la vista para cada momento de la escena. */
const AT = { offer: 4, reserved: 6, hold: 7 }
const HOLD = PLACE.graceMinutes

function caption(view: AlturaView, reserved: boolean): { title: string; sub: string } {
  if (view.kind === 'table') {
    const t = TABLES.find((x) => x.label === view.label)!
    const state =
      t.label === CHOSEN
        ? reserved
          ? 'reservada para Camila · sábado 20:30'
          : 'libre a esa hora · la que ofrece el agente'
        : t.tone === 'tomada'
          ? 'ocupada a esa hora'
          : 'libre a esa hora'
    return { title: `Mesa ${t.label} · ${t.seats} personas`, sub: `${FACING_TEXT[t.facing]} · ${state}` }
  }
  if (view.kind === 'terrace') return { title: 'Terraza Mirador · piso 12', sub: 'al aire libre, frente a la Torre Titanium' }
  return { title: `${PLACE.name} · pisos 11 y 12`, sub: 'la cámara gira alrededor del edificio' }
}

const sameView = (a: AlturaView, b: AlturaView) =>
  a.kind === b.kind && (a.kind !== 'table' || (b.kind === 'table' && a.label === b.label))

const CHIPS: { v: AlturaView; l: string }[] = [
  { v: { kind: 'orbit' }, l: 'Girar alrededor' },
  { v: { kind: 'table', label: CHOSEN }, l: 'Mesa 3 · Torre Titanium' },
  { v: { kind: 'table', label: '5' }, l: 'Mesa 5 · Cordillera' },
  { v: { kind: 'terrace' }, l: 'Terraza' },
]

export default function AlturaCaso({ caso }: { caso: Caso }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<AlturaScene | null>(null)
  /** Alguien tocó la escena: deja de seguir el chat hasta que se reproduzca de nuevo. */
  const manualRef = useRef(false)
  const [view, setViewState] = useState<AlturaView>({ kind: 'orbit' })
  const [reserved, setReservedState] = useState(false)
  const [hold, setHold] = useState(false)
  const [state, setState] = useState<'idle' | 'ready' | 'error'>('idle')

  // Lo último que se pidió, para la escena (que puede cargar después) y sin pasar por los estados de React
  const viewRef = useRef<AlturaView>({ kind: 'orbit' })
  const reservedRef = useRef(false)

  const applyView = useCallback((v: AlturaView) => {
    if (sameView(viewRef.current, v)) return
    viewRef.current = v
    setViewState(v)
    sceneRef.current?.setView(v)
  }, [])

  const applyReserved = useCallback((on: boolean) => {
    if (reservedRef.current === on) return
    reservedRef.current = on
    setReservedState(on)
    sceneRef.current?.setReserved(on)
  }, [])

  const choose = (v: AlturaView) => {
    manualRef.current = true
    applyView(v)
  }

  // El chat manda: cada vez que aparece un mensaje, la escena se pone al día.
  useEffect(() => {
    const section = rootRef.current?.closest('[data-caso]')
    if (!section) return
    const onStep = (event: Event) => {
      const { shown } = (event as CustomEvent<{ shown: number }>).detail
      if (shown === 0) manualRef.current = false
      applyReserved(shown >= AT.reserved)
      setHold(shown >= AT.hold)
      if (manualRef.current) return
      applyView(shown >= AT.offer ? { kind: 'table', label: CHOSEN } : { kind: 'orbit' })
    }
    section.addEventListener('zv:caso', onStep)
    return () => section.removeEventListener('zv:caso', onStep)
  }, [applyView, applyReserved])

  // La escena se crea cuando la sección se acerca a la pantalla, y solo dibuja mientras se ve.
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
            // Si el chat ya avanzó mientras cargaba, la escena parte en el punto correcto
            if (viewRef.current.kind !== 'orbit') created.setView(viewRef.current)
            created.setReserved(reservedRef.current)
            created.setVisible(true)
            setState('ready')
          })
          .catch((error) => {
            console.warn('[landing] no se pudo iniciar la escena de Altura:', error)
            setState('error')
          })
      },
      { rootMargin: '300px 0px' },
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

  const selected = view.kind === 'table' ? view.label : null
  const text = caption(view, reserved)

  return (
    <div className="zv-ft-grid zv-mesas-ft" data-reveal ref={rootRef}>
      <CasoPhone caso={caso} />

      <div className="zv-mesas-col" data-reveal-item>
        <div className="zv-altura" ref={stageRef} data-state={state}>
          <canvas ref={canvasRef} className="zv-altura-canvas" aria-hidden="true" />
          <div className="zv-altura-cap" aria-live="polite">
            <strong>{text.title}</strong>
            <span>{text.sub}</span>
          </div>
          <p className={`zv-altura-hold${hold ? ' is-on' : ''}`}>
            ⏱ Se guarda {HOLD} min después de la hora. Si no llega, la mesa se libera.
          </p>
          <div className="zv-altura-chips" role="group" aria-label="Elegir vista">
            {CHIPS.map((c) => (
              <button key={c.l} type="button" aria-pressed={sameView(view, c.v)} onClick={() => choose(c.v)} disabled={state === 'error'}>
                {c.l}
              </button>
            ))}
          </div>
          {state === 'error' && <p className="zv-altura-fallback">Tu navegador no muestra 3D: mira el croquis de abajo.</p>}
        </div>

        <div className="zv-mesas-under">
          <CasoSteps caso={caso} />

          <figure className="zv-mesas-card">
            <p className="zv-mesas-place">
              <strong>{PLACE.floor}</strong>
              <span>toca una mesa</span>
            </p>
            <svg
              className="zv-mesas-plan"
              viewBox="0 0 400 300"
              role="group"
              aria-label="Croquis de ejemplo de Altura Bistró: un ventanal al sol con vista a la Torre Titanium y otro a la sombra hacia la cordillera. Toca una mesa para ver su vista."
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
                // La mesa del chat se pinta como reservada cuando el agente confirma
                const tone = t.label === CHOSEN && reserved ? 'reservada' : t.tone
                const v: AlturaView = { kind: 'table', label: t.label }
                return (
                  <g
                    key={t.label}
                    className={`zv-mesas-t zv-mesas-t--${tone}${isSelected ? ' is-chosen' : ''}`}
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
              <span className="is-tomada">Ocupada</span>
              <span className="is-reservada">Reservada ahora</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </div>
  )
}
