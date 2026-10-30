import { SplitWords } from './Stage'

/**
 * Reservas de mesa para restaurantes: el croquis del salón y una conversación
 * de ejemplo. El dibujo es decorativo (lo mismo que dibuja el dueño en el
 * panel, en chico); lo que cuenta la sección está en el texto.
 */

const POINTS = [
  {
    title: 'El croquis de cada piso',
    text: 'Arrastras mesas redondas, cuadradas o largas, con su nombre y cuántas personas caben. También la barra, las puertas y la terraza.',
  },
  {
    title: 'Ventana, sol o sombra',
    text: 'Marcas qué ventanas dan al sol y cuáles a la sombra. Las mesas pegadas a una quedan como «de ventana» y toman su lado, sin marcarlas una por una.',
  },
  {
    title: 'Reservas sin choques',
    text: 'Antes de confirmar, el agente revisa el horario, cuántos caben y las otras reservas. Si no hay lo que pidieron, ofrece otra mesa u otra hora.',
  },
  {
    title: 'Tu salón de un vistazo',
    text: 'En el panel ves qué mesas están tomadas a cualquier hora y anotas las reservas que llegan por teléfono.',
  },
]

const CHAT = [
  { from: 'in', text: 'Hola! ¿tienen mesa para 4 el sábado a las 21:00? Ojalá junto a la ventana 🙏' },
  {
    from: 'out',
    text: '¡Hola! Sí 🙌 Te dejo la Mesa 6 del segundo piso, junto a la ventana 2, del lado de la sombra. ¿A nombre de quién la reservo?',
  },
  { from: 'in', text: 'A nombre de Camila' },
  { from: 'out', text: 'Listo, Camila: sábado 21:00, 4 personas, Mesa 6 junto a la ventana. ¡Te esperamos!' },
] as const

type Table = { x: number; y: number; r?: number; w?: number; h?: number; label: string; tone: 'sol' | 'sombra' | 'libre' | 'tomada' }

const TABLES: Table[] = [
  { x: 70, y: 70, r: 22, label: '1', tone: 'sol' },
  { x: 150, y: 70, r: 22, label: '2', tone: 'sol' },
  { x: 250, y: 60, w: 60, h: 40, label: '6', tone: 'sombra' },
  { x: 335, y: 60, w: 44, h: 40, label: '7', tone: 'tomada' },
  { x: 90, y: 165, r: 20, label: '3', tone: 'libre' },
  { x: 175, y: 165, r: 20, label: '4', tone: 'tomada' },
  { x: 265, y: 160, w: 44, h: 40, label: '8', tone: 'libre' },
  { x: 60, y: 250, w: 80, h: 34, label: '5', tone: 'libre' },
]

function Plan() {
  return (
    <svg className="zv-mesas-plan" viewBox="0 0 400 300" role="img" aria-label="Croquis de ejemplo: un salón con dos ventanas, una al sol y otra a la sombra, y la mesa 6 elegida junto a la ventana de la sombra.">
      <defs>
        <pattern id="zv-mesas-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(239,231,216,0.06)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="1" y="1" width="398" height="298" rx="14" className="zv-mesas-floor" />
      <rect x="1" y="1" width="398" height="298" rx="14" fill="url(#zv-mesas-grid)" />
      {/* Ventanas en la pared de arriba */}
      <rect x="40" y="6" width="140" height="8" rx="3" className="zv-mesas-win zv-mesas-win--sol" />
      <text x="110" y="30" className="zv-mesas-tag">ventana 1 · sol</text>
      <rect x="230" y="6" width="150" height="8" rx="3" className="zv-mesas-win zv-mesas-win--sombra" />
      <text x="305" y="30" className="zv-mesas-tag">ventana 2 · sombra</text>
      {/* Terraza y barra */}
      <rect x="22" y="222" width="160" height="70" rx="8" className="zv-mesas-zone" />
      <text x="32" y="240" className="zv-mesas-tag zv-mesas-tag--left">terraza</text>
      <rect x="250" y="240" width="130" height="34" rx="4" className="zv-mesas-bar" />
      <text x="315" y="262" className="zv-mesas-tag">barra</text>
      {TABLES.map((t) => {
        const chosen = t.label === '6'
        return (
          <g key={t.label} className={`zv-mesas-t zv-mesas-t--${t.tone}${chosen ? ' is-chosen' : ''}`}>
            {chosen && <rect x={t.x - 8} y={t.y - 8} width={(t.w ?? 0) + 16} height={(t.h ?? 0) + 16} rx="12" className="zv-mesas-ring" />}
            {t.r ? <circle cx={t.x} cy={t.y} r={t.r} /> : <rect x={t.x} y={t.y} width={t.w} height={t.h} rx="7" />}
            <text x={t.r ? t.x : t.x + (t.w ?? 0) / 2} y={(t.r ? t.y : t.y + (t.h ?? 0) / 2) + 4}>
              {t.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function Mesas() {
  return (
    <section id="mesas" className="zv-sec zv-mesas" data-section="mesas" aria-labelledby="zv-mesas-title">
      <div className="zv-col zv-col--wide">
        <header className="zv-head" data-reveal>
          <p className="zv-label" data-reveal-item>
            <span>Nuevo</span> — Restaurantes
          </p>
          <h2 id="zv-mesas-title" className="zv-h2">
            <SplitWords text="Tu salón, mesa por mesa, dentro del chat." accent={[1]} />
          </h2>
          <p className="zv-intro" data-reveal-item>
            Dibuja cada piso de tu restaurante y el agente reserva solo, a cualquier hora. Al cliente le dice exactamente
            dónde se va a sentar: junto a la ventana, al sol o a la sombra, en la terraza.
          </p>
        </header>

        <div className="zv-mesas-grid">
          <ul className="zv-mesas-points" data-reveal>
            {POINTS.map((p, i) => (
              <li key={p.title} data-reveal-item>
                <span className="zv-mesas-n">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.text}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="zv-mesas-demo" data-reveal>
            <figure className="zv-mesas-card" data-reveal-item>
              <Plan />
              <figcaption className="zv-mesas-legend">
                <span className="is-sol">Sol</span>
                <span className="is-sombra">Sombra</span>
                <span className="is-libre">Libre</span>
                <span className="is-tomada">Reservada</span>
              </figcaption>
            </figure>
            <div className="zv-mesas-chat" data-reveal-item aria-label="Conversación de ejemplo">
              {CHAT.map((m, i) => (
                <p key={i} className={`zv-mesas-msg zv-mesas-msg--${m.from}`}>
                  {m.text}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
