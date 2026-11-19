import { STREET } from './data'

/**
 * Franja de rubros en movimiento: le da vida al paso del inicio a la demo y
 * deja claro de un vistazo que sirve para cualquier negocio. Se repite dos
 * veces para que el bucle no tenga salto; la segunda copia es decorativa.
 */
const EXTRA = [
  { id: 'unas', emoji: '💅', label: 'Uñas y belleza' },
  { id: 'food', emoji: '🌭', label: 'Food trucks' },
]

export default function Ticker() {
  const items = [...EXTRA, ...STREET.map((s) => ({ id: s.id, emoji: s.emoji, label: s.label }))]
  return (
    <div className="zv-ticker" aria-label="Rubros que atiende ZeroVisto">
      <div className="zv-ticker-track">
        {[0, 1].map((copy) => (
          <ul key={copy} className="zv-ticker-list" aria-hidden={copy === 1 ? true : undefined}>
            {items.map((item, i) => (
              <li key={`${copy}-${item.id}`} className="zv-ticker-chip" data-tone={i % 5}>
                <span aria-hidden="true">{item.emoji}</span> {item.label}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}
