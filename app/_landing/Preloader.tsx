'use client'

import { useEffect, useRef } from 'react'
import { bus } from './bus'

/**
 * Precarga: mientras se arma la cuadra (fuentes, 3D, shaders) se muestra el
 * avance real. Si el mundo no puede cargar, se va igual a los pocos segundos:
 * la página nunca queda tapada. Sin movimiento o sin JavaScript no aparece.
 */
export default function Preloader() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    const root = document.documentElement
    if (!el || !root.classList.contains('js-motion')) return
    const bar = el.querySelector<HTMLElement>('[data-pre-bar]')
    const pct = el.querySelector<HTMLElement>('[data-pre-pct]')
    let shown = 0
    let raf = 0
    let done = false
    const t0 = performance.now()
    const finish = () => {
      if (done) return
      done = true
      root.classList.add('zv-loaded')
      el.dataset.state = 'out'
      window.setTimeout(() => el.remove(), 1100)
    }
    const loop = () => {
      const elapsed = performance.now() - t0
      // Nunca más de 7 segundos tapando la página.
      const target = elapsed > 7000 ? 1 : Math.max(bus.load, Math.min(0.15, elapsed / 4000))
      shown += (target - shown) * 0.12
      if (target >= 1 && shown > 0.985) shown = 1
      if (bar) bar.style.transform = `scaleX(${shown.toFixed(3)})`
      if (pct) pct.textContent = `${Math.round(shown * 100)}%`
      if (shown >= 1) {
        window.setTimeout(finish, 250)
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={ref} className="zv-pre" aria-hidden="true">
      <div className="zv-pre-in">
        <svg className="zv-mark" viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
          <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M13 25.5l5.2 5.2L30 19" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 30.7L33 19" fill="none" stroke="#53bdeb" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        <p className="zv-pre-word">ZEROVISTO</p>
        <div className="zv-pre-line">
          <span className="zv-pre-bar" data-pre-bar />
        </div>
        <p className="zv-pre-meta">
          <span>Encendiendo la cuadra</span>
          <span data-pre-pct>0%</span>
        </p>
      </div>
    </div>
  )
}
