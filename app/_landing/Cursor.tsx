'use client'

import { useEffect, useRef } from 'react'

/** Cursor propio: solo con puntero fino y cuando se permite el movimiento. */
/** La barra de arriba se vuelve sólida cuando termina el escenario, para no cruzarse con el texto. */
function useSolidNav() {
  useEffect(() => {
    const zone = document.querySelector('[data-zone]')
    const nav = document.querySelector<HTMLElement>('.zv-nav')
    if (!zone || !nav) return
    const io = new IntersectionObserver(
      ([entry]) => {
        nav.dataset.solid = entry.isIntersecting ? 'false' : 'true'
      },
      { rootMargin: '-72px 0px 0px 0px' },
    )
    io.observe(zone)
    return () => io.disconnect()
  }, [])
}

export default function Cursor() {
  useSolidNav()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fine = window.matchMedia('(pointer: fine)').matches
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || calm) return

    let x = -100
    let y = -100
    let cx = x
    let cy = y
    let raf = 0
    const loop = () => {
      cx += (x - cx) * 0.22
      cy += (y - cy) * 0.22
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`
      raf = requestAnimationFrame(loop)
    }
    const onMove = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      el.dataset.on = 'true'
      el.dataset.hover = (e.target as Element | null)?.closest('a, button') ? 'true' : 'false'
    }
    const onLeave = () => {
      el.dataset.on = 'false'
    }
    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <div ref={ref} className="zv-cursor" aria-hidden="true" />
}
