import AlturaDemo from './AlturaDemo'
import { SplitWords } from './Stage'

/**
 * Reservas de mesa para restaurantes. El ejemplo (Altura Bistró en 3D, su
 * croquis y el chat) está en `AlturaDemo`; acá va el texto de la sección.
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
            dónde se va a sentar: frente al ventanal con vista a la torre, al sol o a la sombra, en la terraza.
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

          <AlturaDemo />
        </div>
      </div>
    </section>
  )
}
