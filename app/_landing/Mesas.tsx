import AlturaCaso from './AlturaCaso'
import { RESERVA_CASO as caso } from './data'
import { SplitWords } from './Stage'

/**
 * Reservas de mesa para restaurantes, actuado como los otros ejemplos en vivo
 * (`data-caso`): el chat avanza con el scroll y Altura Bistró en 3D lo sigue
 * (`AlturaCaso`). Debajo, cómo funciona para cualquier restaurante.
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
    title: 'Tolerancia de 15 minutos',
    text: 'El agente avisa al confirmar hasta qué hora se guarda la mesa. Si el cliente no llega, la liberas con un toque y queda libre para otra reserva.',
  },
  {
    title: 'Tu salón de un vistazo',
    text: 'En el panel ves qué mesas están tomadas a cualquier hora y anotas las reservas que llegan por teléfono.',
  },
]

export default function Mesas() {
  return (
    <section id="mesas" className="zv-sec zv-caso zv-mesas" data-section="mesas" data-caso aria-labelledby="zv-mesas-title">
      <div className="zv-col zv-col--wide">
        <header className="zv-head zv-head--big" data-reveal>
          <p className="zv-label" data-reveal-item>
            <span>{caso.tag}</span> — {caso.label}
          </p>
          <h2 id="zv-mesas-title" className="zv-h2 zv-h2--case">
            <SplitWords text={caso.title} accent={caso.accent} />
          </h2>
          <p className="zv-intro" data-reveal-item>
            {caso.intro}
          </p>
        </header>

        <AlturaCaso caso={caso} />

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
      </div>
    </section>
  )
}
