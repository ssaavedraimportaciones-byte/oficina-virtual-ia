'use client'

import { useId } from 'react'
import { BRAND } from '@/lib/brand'

/** Marca + nombre, para encabezados de pantallas (login, panel, legales). */
export function BrandLockup({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex w-fit items-center gap-2 font-mono text-lg font-semibold text-amber-400 ${className}`}>
      <BrandMark size={size} />
      {BRAND.name}
    </span>
  )
}

const RING = { x: 262, y: 196, width: 440, height: 632, rx: 220 }
const CHECK_FRONT = 'M318 548 L410 640 L640 352'
const CHECK_BACK = 'M480 570 L550 640 L780 352'

/**
 * Marca "cero en visto": un 0 ámbar atravesado por el doble visto. Los huecos
 * entre piezas son máscaras, no trazos de color de fondo, así queda limpio
 * sobre el cielo de la landing, el panel oscuro o un fondo claro.
 */
export default function BrandMark({ size = 32, className, title }: { size?: number; className?: string; title?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      viewBox="142 142 740 740"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}a`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#ffe0a0" />
          <stop offset="0.5" stopColor="#ffb347" />
          <stop offset="1" stopColor="#ff8414" />
        </linearGradient>
        <linearGradient id={`${id}k`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#22d3a6" />
          <stop offset="1" stopColor="#86efc4" />
        </linearGradient>
        <mask id={`${id}m1`} maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
          <rect width="1024" height="1024" fill="#fff" />
          <path d={CHECK_FRONT} stroke="#000" strokeWidth="104" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </mask>
        <mask id={`${id}m2`} maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
          <rect width="1024" height="1024" fill="#fff" />
          <path d={CHECK_BACK} stroke="#000" strokeWidth="104" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </mask>
      </defs>
      <g mask={`url(#${id}m1)`}>
        <rect {...RING} fill="none" stroke={`url(#${id}a)`} strokeWidth="96" mask={`url(#${id}m2)`} />
        <path d={CHECK_BACK} stroke={`url(#${id}k)`} strokeWidth="58" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path d={CHECK_FRONT} stroke={`url(#${id}k)`} strokeWidth="58" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
