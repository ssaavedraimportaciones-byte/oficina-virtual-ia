import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { INDUSTRY_TEMPLATES } from '@/lib/industries'
import Cursor from './_landing/Cursor'
import Stage, { SplitWords } from './_landing/Stage'
import StaticStory from './_landing/Static'
import World from './_landing/World'
import './_landing/landing.css'

const STEPS = [
  {
    title: 'Elige tu rubro',
    text: 'El agente parte con el tono y las preguntas de tu tipo de negocio. Tú ajustas lo que quieras.',
  },
  {
    title: 'Cárgale tu información',
    text: 'Precios, horarios, servicios y productos. Es lo único que el agente puede afirmar, así que no inventa. Puedes importarla desde tu sitio web o tu Instagram.',
  },
  {
    title: 'Conecta tus canales',
    text: 'Tu WhatsApp Business o tu Instagram. Antes puedes probar al agente en el simulador, escribiendo como si fueras el cliente.',
  },
  {
    title: 'Tú te dedicas a tu negocio',
    text: 'El agente atiende. Tú recibes las horas agendadas, los pedidos ya registrados y los casos que necesitan a una persona.',
  },
]

const GUARDRAILS = [
  {
    title: 'No inventa',
    text: 'Solo afirma lo que cargaste: precios, horarios, servicios, stock. Si no lo sabe, lo dice o pasa el caso.',
  },
  {
    title: 'Se detiene cuando corresponde',
    text: 'Si el cliente reclama o pide una persona, el agente se pausa. Tú respondes desde el panel y se lo devuelves cuando quieras.',
  },
  {
    title: 'Tiene tope mensual',
    text: 'Cada plan incluye una cantidad de respuestas al mes y la ves en tu resumen. Si se agota, tu cliente recibe un aviso en vez de quedar en visto, y tú, un mail.',
  },
  {
    title: 'Si algo falla, avisa',
    text: 'Si la IA se cae o la plataforma entra en mantenimiento, tu cliente recibe un mensaje claro. Sus mensajes quedan guardados para que tu equipo los vea.',
  },
]

const MULTI = [
  {
    title: 'Cada negocio, lo suyo',
    text: 'Conversaciones, agenda, catálogo, canales y conocimiento viven separados por negocio. Lo de uno nunca se mezcla con lo de otro.',
  },
  {
    title: 'Dueños y equipo',
    text: 'Invita a tu gente con el rol que corresponde. El dueño administra el negocio; el equipo atiende las conversaciones.',
  },
  {
    title: 'Un solo ingreso',
    text: 'Si tienes más de un negocio, los ves todos desde la misma cuenta y cambias de uno a otro con un clic.',
  },
]

function Nav() {
  return (
    <header className="zv-nav">
      <Link href="/" className="zv-brand" aria-label={`${BRAND.name}, inicio`}>
        {BRAND.name}
      </Link>
      <nav aria-label="Principal" className="zv-navlinks">
        <a href="#noche">Una noche</a>
        <a href="#rubros">Rubros</a>
        <a href="#empieza">Cómo empieza</a>
      </nav>
      <div className="zv-navright">
        <Link href="/panel" className="zv-navlogin">
          Ingresar
        </Link>
        <Link href="/registro" className="zv-btn zv-btn--sm">
          Probar gratis
        </Link>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="zv-hero" data-hero aria-labelledby="zv-hero-title">
      <div className="zv-hero-sticky" data-hero-content>
        <p className="zv-eyebrow">{BRAND.tagline}</p>
        <h1 id="zv-hero-title" className="zv-title">
          <SplitWords text="Tu cliente escribe. ZeroVisto responde." accent={[4]} breakAfter={[2]} />
        </h1>
        <p className="zv-lead">
          Un agente de IA que atiende tu WhatsApp e Instagram al tiro, a cualquier hora: responde dudas, agenda horas,
          toma pedidos y te pasa el caso cuando hace falta una persona. Se adapta a cualquier rubro.
        </p>
        <div className="zv-cta-row">
          <Link href="/registro" className="zv-btn">
            Probar gratis
          </Link>
          <a href="#noche" className="zv-btn zv-btn--ghost">
            Ver una noche entera
          </a>
        </div>
        <span className="zv-hero-v" aria-hidden="true">
          Cero en visto
        </span>
        <span className="zv-cue" aria-hidden="true">
          <i /> Baja y mira la noche
        </span>
      </div>
    </section>
  )
}

function Steps() {
  return (
    <section id="empieza" className="zv-sec" aria-labelledby="zv-steps-title">
      <div className="zv-sec-head">
        <p className="zv-sec-label">
          <span>06</span>Cómo empieza
        </p>
        <h2 id="zv-steps-title" className="zv-sec-title">
          Listo para esta noche, en cuatro pasos.
        </h2>
      </div>
      <ol className="zv-list">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <span className="n">{String(i + 1).padStart(2, '0')}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Industries() {
  return (
    <section id="rubros" className="zv-sec" aria-labelledby="zv-rubros-title">
      <div className="zv-sec-head">
        <p className="zv-sec-label">
          <span>07</span>Rubros
        </p>
        <h2 id="zv-rubros-title" className="zv-sec-title">
          Se adapta a tu negocio.
        </h2>
        <p className="zv-sec-intro">
          Elige tu rubro y el agente parte con el tono, los objetivos y la lista de lo que conviene cargar. Son un punto de
          partida: el rubro es texto libre y todo se puede editar después.
        </p>
      </div>
      <ul className="zv-rubros">
        {INDUSTRY_TEMPLATES.map((t) => (
          <li key={t.id} className="zv-rubro">
            <span className="e" aria-hidden="true">
              {t.emoji}
            </span>
            <h3>{t.label}</h3>
            <p>{t.industry || 'Cualquier otro: describes tu negocio y el agente se arma a su medida.'}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Multi() {
  return (
    <section className="zv-sec" aria-labelledby="zv-multi-title">
      <div className="zv-sec-head">
        <p className="zv-sec-label">
          <span>08</span>Varios negocios
        </p>
        <h2 id="zv-multi-title" className="zv-sec-title">
          Muchos negocios. Cero mezcla.
        </h2>
      </div>
      <div className="zv-cols">
        {MULTI.map((item) => (
          <div key={item.title} className="zv-col">
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Guardrails() {
  return (
    <section className="zv-sec" aria-labelledby="zv-guard-title">
      <div className="zv-sec-head">
        <p className="zv-sec-label">
          <span>09</span>Con los pies en la tierra
        </p>
        <h2 id="zv-guard-title" className="zv-sec-title">
          Lo que el agente no hace.
        </h2>
        <p className="zv-sec-intro">
          Un agente que contesta a las 11 de la noche tiene que saber cuándo parar. Esto es lo que ya viene resuelto.
        </p>
      </div>
      <div className="zv-cols zv-cols--4">
        {GUARDRAILS.map((item) => (
          <div key={item.title} className="zv-col">
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Final() {
  return (
    <section className="zv-final" aria-labelledby="zv-final-title">
      <p className="zv-sec-label">
        <span>10</span>Esta noche
      </p>
      <h2 id="zv-final-title" className="zv-sec-title" style={{ marginTop: '1.4rem' }}>
        Que ningún cliente más quede en <em className="zv-acc">visto.</em>
      </h2>
      <p className="zv-sec-intro">
        Crea tu agente en minutos y pruébalo en el simulador antes de conectar tus canales.
      </p>
      <div className="zv-cta-row">
        <Link href="/registro" className="zv-btn">
          Probar gratis
        </Link>
        <Link href="/panel" className="zv-btn zv-btn--ghost">
          Ya tengo cuenta
        </Link>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="zv-foot">
      <span className="zv-brand">{BRAND.name}</span>
      <nav aria-label="Legal">
        <Link href="/terminos">Términos</Link>
        <Link href="/privacidad">Privacidad</Link>
      </nav>
      <span>
        &copy; {new Date().getFullYear()} {BRAND.name}. Todos los derechos reservados.
      </span>
    </footer>
  )
}

export default function Home() {
  return (
    <div className="zv">
      <a href="#contenido" className="zv-skip">
        Saltar al contenido
      </a>
      <Nav />
      <main id="contenido">
        <div className="zv-zone" data-zone>
          <World />
          <Hero />
          <div id="noche">
            <Stage />
            <StaticStory />
          </div>
        </div>
        <Steps />
        <Industries />
        <Multi />
        <Guardrails />
        <Final />
      </main>
      <Footer />
      <Cursor />
    </div>
  )
}
