'use client'

import { RAIL } from './data'

declare global {
  interface Window {
    /** Lo define el director de scroll (motion.ts): lleva a un capítulo con el scroll suave. */
    zvGoTo?: (id: string) => void
  }
}

/** Riel de capítulos a la derecha: dónde estás en la página, y un atajo a cada escena. */
export default function Rail() {
  return (
    <nav className="zv-rail" aria-label="Capítulos">
      <ol>
        {RAIL.map((c) => (
          <li key={c.id}>
            <a
              href={`#${c.id}`}
              data-rail={c.id}
              data-cursor="Ir"
              onClick={(e) => {
                if (window.zvGoTo) {
                  e.preventDefault()
                  window.zvGoTo(c.id)
                }
              }}
            >
              <span className="zv-rail-n">{c.n}</span>
              <span className="zv-rail-t">{c.label}</span>
              <i aria-hidden="true" />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
