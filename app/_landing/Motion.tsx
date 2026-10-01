'use client'

import { useEffect } from 'react'

/** Monta el director de scroll (motion.ts) cuando se permite el movimiento. */
export default function Motion() {
  useEffect(() => {
    if (!document.documentElement.classList.contains('js-motion')) return
    let dispose: (() => void) | undefined
    let cancelled = false
    void import('./motion').then(async ({ initMotion }) => {
      const d = await initMotion()
      if (cancelled) d()
      else dispose = d
    })
    return () => {
      cancelled = true
      dispose?.()
    }
  }, [])
  return null
}
