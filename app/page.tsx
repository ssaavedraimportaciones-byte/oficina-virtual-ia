const CHANNELS = ['WhatsApp', 'Instagram DM', 'Chat web', 'Email']

const FEATURES = [
  {
    title: 'Responde en segundos, 24/7',
    description:
      'El agente de IA contesta cada chat entrante al instante, sin horarios ni turnos, así el prospecto nunca se enfría esperando.',
  },
  {
    title: 'WhatsApp e Instagram unificados',
    description:
      'Todos los canales donde ya te escriben tus clientes llegan a una sola bandeja. Sin mantener integraciones por separado.',
  },
  {
    title: 'Calificación automática de leads',
    description:
      'El agente pregunta lo justo y necesario para saber si el prospecto sirve, y prioriza los que están listos para comprar.',
  },
  {
    title: 'Agenda reuniones solo',
    description:
      'Revisa la disponibilidad de tu equipo y coordina la reunión directamente en el chat, sin ida y vuelta manual.',
  },
  {
    title: 'Reabre conversaciones frías',
    description:
      'Detecta leads e hilos abandonados y vuelve a escribirles automáticamente para retomar la venta.',
  },
  {
    title: 'Entrega el lead tibio a tu equipo',
    description:
      'Cuando el prospecto está listo para cerrar, el agente pasa la conversación a un humano con todo el contexto, sin handoff manual.',
  },
]

const STEPS = [
  {
    step: '01',
    title: 'Conectá tus canales',
    description: 'WhatsApp Business, Instagram, chat web o email, desde una misma configuración.',
  },
  {
    step: '02',
    title: 'Definí tu agente',
    description: 'Le contás a qué se dedica tu empresa, qué preguntar y cuándo escalar a un humano.',
  },
  {
    step: '03',
    title: 'El agente conversa y califica',
    description: 'Responde, pregunta y prioriza leads en tiempo real dentro del CRM.',
  },
  {
    step: '04',
    title: 'Vos cerrás la venta',
    description: 'Recibís el lead calificado y agendado, listo para que tu equipo lo cierre.',
  },
]

const INDUSTRIES = [
  'Inmobiliarias',
  'Clínicas y salud',
  'Retail y e-commerce',
  'Gastronomía',
  'Servicios profesionales',
  'Educación',
  'Concesionarias',
  'Turismo',
]

function Nav() {
  return (
    <header className="border-b border-gray-800">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-mono text-lg font-semibold text-amber-400">AgentsApp</span>
        <nav className="hidden items-center gap-8 text-sm text-gray-300 md:flex">
          <a href="#producto" className="hover:text-white">Producto</a>
          <a href="#funciones" className="hover:text-white">Funciones</a>
          <a href="#rubros" className="hover:text-white">Rubros</a>
          <a href="/panel" className="hover:text-white">Ingresar</a>
        </nav>
        <a
          href="/panel/configurar"
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400"
        >
          Probar gratis
        </a>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section id="producto" className="mx-auto max-w-6xl px-6 py-24 text-center">
      <p className="mb-4 font-mono text-sm uppercase tracking-widest text-amber-400">
        CRM con agentes de IA
      </p>
      <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight text-white md:text-6xl">
        Convertí cada chat en una venta
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
        Un agente de IA que responde WhatsApp e Instagram al instante, califica a tus leads y agenda
        reuniones por vos. Moldeable a cualquier empresa, sin importar el rubro.
      </p>
      <div className="mt-10 flex items-center justify-center gap-4">
        <a
          href="/panel/configurar"
          className="rounded-md bg-amber-500 px-6 py-3 font-medium text-gray-950 hover:bg-amber-400"
        >
          Probar gratis
        </a>
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
            Un vendedor de IA que nunca duerme
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-400">
            Deja de perder leads por demoras en responder. El agente hace el trabajo repetitivo,
            tu equipo se queda con las conversaciones que ya están listas para cerrar.
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
        <h2 className="text-3xl font-bold text-white md:text-4xl">Moldeable a toda empresa</h2>
        <p className="mx-auto mt-4 max-w-2xl text-gray-400">
          El agente se configura con el tono, las preguntas y el proceso de venta de tu rubro.
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
          Dejá de perder leads por no responder a tiempo
        </h2>
        <p className="mt-4 text-gray-400">
          Coordiná una demo y te mostramos el agente configurado para tu rubro.
        </p>
        <a
          href="/panel/configurar"
          className="mt-8 inline-block rounded-md bg-amber-500 px-8 py-3 font-medium text-gray-950 hover:bg-amber-400"
        >
          Probar gratis
        </a>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-gray-800 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-gray-500 md:flex-row">
        <span className="font-mono text-amber-400">AgentsApp</span>
        <span>&copy; {new Date().getFullYear()} AgentsApp. Todos los derechos reservados.</span>
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
