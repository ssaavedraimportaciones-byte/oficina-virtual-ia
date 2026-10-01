'use client'

import { useEffect, useRef } from 'react'
import { bus } from './bus'
import { STREET } from './data'

const HOVER_LABEL: Record<string, string> = {
  ana: 'Ana · escribe',
  owner: 'Caro · la dueña',
  shop: 'Uñas Bella',
  ...Object.fromEntries(STREET.map((s) => [`rubro-${s.id}`, s.label])),
}

/**
 * Todo lo que sigue al mouse, solo con puntero fino y movimiento permitido:
 * cursor propio con etiqueta, botones magnéticos, tarjetas que se inclinan con
 * un brillo, y parallax de las capas (primeros planos y la palabra gigante).
 * Con el dedo o con «menos movimiento» no se monta nada de esto.
 */
export default function Pointer() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || calm) return
    const root = document.documentElement
    root.classList.add('zv-cursor-on')
    const dot = el.querySelector<HTMLElement>('[data-c-dot]')!
    const ring = el.querySelector<HTMLElement>('[data-c-ring]')!
    const label = el.querySelector<HTMLElement>('[data-c-label]')!

    let x = window.innerWidth / 2
    let y = window.innerHeight / 2
    let rx = x
    let ry = y
    let px = 0
    let py = 0
    let raf = 0
    let target: HTMLElement | null = null
    let magnet: HTMLElement | null = null
    let tilt: HTMLElement | null = null
    let lastLabel = ''

    const setLabel = (text: string) => {
      if (text === lastLabel) return
      lastLabel = text
      label.textContent = text
      el.dataset.label = text ? 'true' : 'false'
    }

    const loop = () => {
      rx += (x - rx) * 0.2
      ry += (y - ry) * 0.2
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      label.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      // Parallax de las capas: valores suaves en variables CSS
      const nx = x / window.innerWidth - 0.5
      const ny = y / window.innerHeight - 0.5
      px += (nx - px) * 0.08
      py += (ny - py) * 0.08
      root.style.setProperty('--px', px.toFixed(4))
      root.style.setProperty('--py', py.toFixed(4))

      // Etiqueta: primero lo que hay en la página (botones, enlaces), si no, lo de la escena 3D
      const domLabel = target?.closest<HTMLElement>('[data-cursor]')?.dataset.cursor
      const interactive = target?.closest('a, button, [data-tilt]')
      const scene = !interactive && bus.hover ? HOVER_LABEL[bus.hover] ?? '' : ''
      setLabel(domLabel ?? scene)
      el.dataset.state = interactive ? 'link' : scene ? 'scene' : 'idle'

      // Botón magnético: se corre un poco hacia el mouse
      if (magnet) {
        const r = magnet.getBoundingClientRect()
        const mx = (x - (r.left + r.width / 2)) * 0.22
        const my = (y - (r.top + r.height / 2)) * 0.32
        magnet.style.transform = `translate3d(${mx.toFixed(1)}px, ${my.toFixed(1)}px, 0)`
      }
      raf = requestAnimationFrame(loop)
    }

    const onMove = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      el.dataset.on = 'true'
      target = e.target as HTMLElement
      const m = target?.closest<HTMLElement>('[data-magnetic]') ?? null
      if (m !== magnet) {
        if (magnet) magnet.style.transform = ''
        magnet = m
      }
      const t = target?.closest<HTMLElement>('[data-tilt]') ?? null
      if (t !== tilt) {
        if (tilt) {
          tilt.style.removeProperty('--rx')
          tilt.style.removeProperty('--ry')
          tilt.dataset.tilting = 'false'
        }
        tilt = t
      }
      if (tilt) {
        const r = tilt.getBoundingClientRect()
        const u = (x - r.left) / r.width
        const v = (y - r.top) / r.height
        tilt.style.setProperty('--rx', `${((0.5 - v) * 7).toFixed(2)}deg`)
        tilt.style.setProperty('--ry', `${((u - 0.5) * 9).toFixed(2)}deg`)
        tilt.style.setProperty('--gx', `${(u * 100).toFixed(1)}%`)
        tilt.style.setProperty('--gy', `${(v * 100).toFixed(1)}%`)
        tilt.dataset.tilting = 'true'
      }
    }
    const onLeave = () => {
      el.dataset.on = 'false'
      if (magnet) magnet.style.transform = ''
      magnet = null
    }
    const onDown = () => (el.dataset.down = 'true')
    const onUp = () => (el.dataset.down = 'false')
    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    root.addEventListener('pointerleave', onLeave)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(raf)
      root.classList.remove('zv-cursor-on')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      root.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div ref={ref} className="zv-cursor" aria-hidden="true" data-on="false" data-state="idle">
      <span className="zv-c-ring" data-c-ring />
      <span className="zv-c-dot" data-c-dot />
      <span className="zv-c-label" data-c-label />
    </div>
  )
}
