/**
 * Primeros planos: recortes con transparencia (cables del alumbrado, ramas de
 * plátano oriental, jacarandá, techos, una baranda) anclados a los bordes de la
 * pantalla. Cada sección es dueña de los suyos: entran enteros, se quedan
 * mientras la sección manda y se difuminan al pasar la posta. Los pinta
 * `scripts/landing/primeros-planos.html` (código, no fotos).
 */
export const FOREGROUND: { id: string; src: string; owners: string[]; place: string; depth: number; w: number; h: number }[] = [
  { id: 'cables', src: '/landing/fg/cables.webp', owners: ['inicio', 'final'], place: 'tl', depth: 1.2, w: 1600, h: 900 },
  { id: 'platano', src: '/landing/fg/platano.webp', owners: ['inicio', 'final'], place: 'tr', depth: 1.8, w: 1400, h: 1100 },
  { id: 'jacaranda', src: '/landing/fg/jacaranda.webp', owners: ['rubros', 'limites'], place: 'tr', depth: 1.6, w: 1400, h: 1100 },
  { id: 'techo', src: '/landing/fg/techo.webp', owners: ['negocios'], place: 'b', depth: 0.9, w: 2400, h: 700 },
  { id: 'baranda', src: '/landing/fg/baranda.webp', owners: ['empieza'], place: 'bl', depth: 1.4, w: 1600, h: 1000 },
]

export default function Foreground() {
  return (
    <div className="zv-fg" data-fg-host aria-hidden="true">
      {FOREGROUND.map((f) => (
        <div key={f.id} className={`zv-fg-l zv-fg-${f.place}`} data-fg={f.id} data-owners={f.owners.join(' ')} style={{ '--d': f.depth } as React.CSSProperties}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.src} alt="" width={f.w} height={f.h} decoding="async" loading="lazy" />
        </div>
      ))}
    </div>
  )
}
