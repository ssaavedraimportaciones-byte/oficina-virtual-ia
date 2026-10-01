'use client'

import { useEffect, useRef } from 'react'
import { bus } from './bus'

/**
 * Capa de ambiente: un lienzo WebGL fijo detrás de todo. Mientras carga (o si
 * el equipo no soporta WebGL, o prefiere menos movimiento) queda el póster en
 * CSS, que ya es una buena primera imagen.
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
        const { createWorld } = await import('./world3d')
        if (cancelled || !canvasRef.current) return
        dispose = createWorld(canvasRef.current, bus)
      } catch (error) {
        console.warn('[landing] no se pudo iniciar el mundo 3D, queda el fondo estático:', error)
      }
    }
    // Primero lo que se ve (texto, póster); el 3D entra cuando el navegador respira.
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    const handle = idle ? idle(() => void start(), { timeout: 1200 }) : window.setTimeout(() => void start(), 200)
    return () => {
      cancelled = true
      if (!idle) window.clearTimeout(handle)
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
