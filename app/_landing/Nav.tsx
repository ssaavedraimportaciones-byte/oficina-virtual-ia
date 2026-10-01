'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BRAND } from '@/lib/brand'
import { NAV } from './data'

/** Barra superior: marca, secciones (con la activa marcada), ingreso y menú en el celular. */
export default function Nav() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.documentElement.classList.add('zv-menu-open')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.classList.remove('zv-menu-open')
    }
  }, [open])

  return (
    <header className="zv-nav" data-open={open ? 'true' : 'false'}>
      <Link href="/" className="zv-brand" aria-label={`${BRAND.name}, inicio`} data-cursor="Inicio">
        <svg className="zv-mark" viewBox="0 0 48 48" width="28" height="28" aria-hidden="true">
          <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M13 25.5l5.2 5.2L30 19" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 30.7L33 19" fill="none" stroke="#53bdeb" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
        <span className="zv-brand-t">
          <span className="zv-brand-n">{BRAND.name}</span>
          <span className="zv-brand-s">{BRAND.tagline}</span>
        </span>
      </Link>
      <nav aria-label="Principal" className="zv-navlinks">
        {NAV.map((n) => (
          <a key={n.id} href={`#${n.id}`} data-nav={n.id} data-cursor="Ir">
            {n.label}
          </a>
        ))}
      </nav>
      <div className="zv-navright">
        <Link href="/panel" className="zv-navlogin" data-cursor="Entrar">
          Ingresar
        </Link>
        <Link href="/registro" className="zv-btn zv-btn--sm" data-magnetic data-cursor="Empezar">
          Probar gratis
        </Link>
        <button type="button" className="zv-menu-btn" aria-expanded={open} aria-controls="zv-menu" onClick={() => setOpen((v) => !v)}>
          <span className="sr-only">{open ? 'Cerrar menú' : 'Abrir menú'}</span>
          <i />
          <i />
        </button>
      </div>
      <div id="zv-menu" className="zv-menu" hidden={!open}>
        <nav aria-label="Menú">
          {NAV.map((n, i) => (
            <a key={n.id} href={`#${n.id}`} onClick={() => setOpen(false)}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {n.label}
            </a>
          ))}
          <Link href="/panel" onClick={() => setOpen(false)}>
            <span>→</span>Ingresar
          </Link>
        </nav>
      </div>
    </header>
  )
}
