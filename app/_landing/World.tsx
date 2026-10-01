'use client'

import { useEffect, useRef } from 'react'
import { bus } from './bus'

/**
 * Capa de ambiente: un lienzo WebGL fijo detrás de toda la página. Mientras
 * carga (o si el equipo no soporta WebGL, o prefiere menos movimiento) queda
 * el póster en CSS.
 */
export default function World() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!document.documentElement.classList.contains('js-motion')) return
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __zv?: typeof bus }).__zv = bus
    let cancelled = false
    let dispose: (() => void) | undefined
    const start = async () => {
      try {
        const { createWorld } = await import('./world')
        if (cancelled || !canvasRef.current) return
        const d = await createWorld(canvasRef.current, bus)
        if (cancelled) d()
        else dispose = d
      } catch (error) {
        console.warn('[landing] no se pudo iniciar el mundo 3D, queda el fondo estático:', error)
        bus.load = 1
      }
    }
    void start()
    return () => {
      cancelled = true
      dispose?.()
    }
  }, [])

  return (
    <div className="zv-world" aria-hidden="true">
      <div className="zv-poster" />
      <canvas ref={canvasRef} className="zv-canvas" />
      <div className="zv-vignette" />
      <div className="zv-grain" />
    </div>
  )
}
