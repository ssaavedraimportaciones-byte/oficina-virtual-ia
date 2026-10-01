import Link from 'next/link'
import { BRAND } from '@/lib/brand'

const CHANNELS = ['WhatsApp', 'Instagram DM', 'Agenda de horas', 'Pedidos y stock']

const FEATURES = [
  {
    title: 'Responde al tiro, 24/7',
    description:
      'Contesta cada mensaje en segundos, de día, de noche y en feriados. El cliente que te escribe a las 11 de la noche no se enfría esperando.',
  },
  {
    title: 'WhatsApp e Instagram en un solo lugar',
    description:
      'Todas las conversaciones llegan a un mismo panel, con el historial de cada cliente. Cada negocio conecta su propio número o su propia cuenta.',
  },
  {
    title: 'Agenda horas de verdad',
    description:
      'Mira tu disponibilidad real, ofrece horarios y reserva sin pisar otras horas. Se acabó el ir y venir por mensajes.',
  },
  {
    title: 'Toma pedidos y cuida tu stock',
    description:
      'Consulta el catálogo, confirma precio y disponibilidad, registra el pedido y descuenta el stock automáticamente.',
  },
  {
    title: 'Se acuerda de cada cliente',
    description:
      'Arma una ficha con lo que cada persona va contando: qué busca, presupuesto, urgencia. Tu equipo la ve al tiro, sin releer la conversación.',
  },
  {
    title: 'Te pasa el caso cuando hace falta',
    description:
      'Si el cliente se molesta o pide hablar con una persona, el agente se pausa y te avisa por mail. Tú respondes desde el panel y le devuelves la conversación cuando quieras.',
  },
]

const STEPS = [
  {
    step: '01',
    title: 'Elige tu rubro',
    description:
      'El agente parte con el tono y las preguntas de tu tipo de negocio. Tú ajustas lo que quieras.',
  },
  {
    step: '02',
    title: 'Cárgale tu información',
    description: 'Precios, horarios, servicios y productos. Es lo único que el agente puede afirmar, así que no inventa.',
  },
  {
    step: '03',
    title: 'Conecta tus canales',
    description: 'Tu WhatsApp Business o tu Instagram. Antes puedes probar al agente en el simulador.',
  },
  {
    step: '04',
    title: 'Tú te dedicas a tu negocio',
    description: 'El agente atiende. Tú recibes las horas agendadas y los pedidos ya registrados, y los casos que necesitan a una persona.',
  },
]

const INDUSTRIES = [
  '💅 Manicura',
  '🦷 Odontología',
  '🔧 Taller mecánico',
  '💈 Peluquería',
  '🏠 Inmobiliaria',
  '🍽️ Gastronomía',
  '🏋️ Gimnasio',
  '⚖️ Estudio jurídico',
  '🛍️ Tienda / E-commerce',
  '✨ Y cualquier otro',
]

function Nav() {
  return (
    <header className="border-b border-gray-800">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-mono text-lg font-semibold text-amber-400">{BRAND.name}</span>
        <nav className="hidden items-center gap-8 text-sm text-gray-300 md:flex">
          <a href="#producto" className="hover:text-white">Producto</a>
          <a href="#funciones" className="hover:text-white">Funciones</a>
          <a href="#rubros" className="hover:text-white">Rubros</a>
          <Link href="/panel" className="hover:text-white">Ingresar</Link>
        </nav>
        <Link
          href="/registro"
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400"
        >
          Probar gratis
        </Link>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section id="producto" className="mx-auto max-w-6xl px-6 py-24 text-center">
      <p className="mb-4 font-mono text-sm uppercase tracking-widest text-amber-400">
        {BRAND.tagline}
      </p>
      <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight text-white md:text-6xl">
        Tu cliente escribe. {BRAND.name} responde.
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
        Un agente de IA que atiende tu WhatsApp e Instagram al tiro, a cualquier hora: responde
        dudas, agenda horas, toma pedidos y te pasa el caso cuando hace falta una persona. Se
        adapta a cualquier rubro.
      </p>
      <div className="mt-10 flex items-center justify-center gap-4">
        <Link
          href="/registro"
          className="rounded-md bg-amber-500 px-6 py-3 font-medium text-gray-950 hover:bg-amber-400"
        >
          Probar gratis
        </Link>
        <a
          href="#funciones"
          className="rounded-md border border-gray-700 px-6 py-3 font-medium text-gray-200 hover:border-gray-500"
        >
          Ver funciones
        </a>
      </div>
      <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
        {CHANNELS.map((channel) => (
          <span
            key={channel}
            className="rounded-full border border-gray-800 bg-gray-900 px-4 py-1.5 text-sm text-gray-300"
          >
            {channel}
          </span>
        ))}
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="funciones" className="border-t border-gray-800 bg-gray-950 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold text-white md:text-4xl">
            Un vendedor que nunca deja a nadie en visto
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-400">
            Deja de perder clientes por demorarte en contestar. El agente se encarga de lo
            repetitivo y tu equipo se queda con lo que de verdad necesita a una persona.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-gray-800 bg-gray-900 p-6"
            >
              <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="border-t border-gray-800 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold text-white md:text-4xl">Cómo funciona</h2>
        </div>
        <div className="grid gap-8 md:grid-cols-4">
          {STEPS.map((item) => (
            <div key={item.step}>
              <span className="font-mono text-sm text-amber-400">{item.step}</span>
              <h3 className="mt-2 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Industries() {
  return (
    <section id="rubros" className="border-t border-gray-800 bg-gray-900/40 py-24">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="text-3xl font-bold text-white md:text-4xl">Se adapta a tu negocio</h2>
        <p className="mx-auto mt-4 max-w-2xl text-gray-400">
          Elige tu rubro y el agente parte con el tono, las preguntas y el proceso de venta que
          corresponde. Un mismo sistema para todos tus negocios.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {INDUSTRIES.map((industry) => (
            <span
              key={industry}
              className="rounded-full border border-gray-800 bg-gray-950 px-5 py-2 text-sm text-gray-300"
            >
              {industry}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section id="demo" className="border-t border-gray-800 py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-bold text-white md:text-4xl">
          Que ningún cliente más quede en visto
        </h2>
        <p className="mt-4 text-gray-400">
          Crea tu agente en minutos y pruébalo en el simulador antes de conectar tus canales.
        </p>
        <Link
          href="/registro"
          className="mt-8 inline-block rounded-md bg-amber-500 px-8 py-3 font-medium text-gray-950 hover:bg-amber-400"
        >
          Probar gratis
        </Link>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-gray-800 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-gray-500 md:flex-row">
        <span className="font-mono text-amber-400">{BRAND.name}</span>
        <div className="flex items-center gap-4">
          <Link href="/terminos" className="hover:text-gray-300">
            Términos
          </Link>
          <Link href="/privacidad" className="hover:text-gray-300">
            Privacidad
          </Link>
        </div>
        <span>&copy; {new Date().getFullYear()} {BRAND.name}. Todos los derechos reservados.</span>
      </div>
    </footer>
  )
}

export default function Home() {
  return (
    <main>
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <Industries />
      <CTA />
      <Footer />
    </main>
  )
}
