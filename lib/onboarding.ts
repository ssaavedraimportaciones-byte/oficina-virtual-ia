import { getIndustryTemplate } from './industries'

/**
 * Primeros pasos de un negocio nuevo: qué le falta para que su agente atienda
 * bien, en orden y explicado. Se calcula con lo que ya hay cargado (no hay que
 * marcar nada a mano): si subió su carta, ese paso aparece listo solo.
 */

export interface SetupFacts {
  templateId: string
  description: string
  goals: string
  knowledgeCount: number
  serviceCount: number
  productCount: number
  floorCount: number
  /** Conversaciones del simulador: si ya probó a su agente. */
  simulatorCount: number
  whatsappConnected: boolean
  instagramConnected: boolean
  hasLogo: boolean
}

export type SetupStepId = 'perfil' | 'conocimiento' | 'operacion' | 'prueba' | 'canal' | 'logo'

export interface SetupStep {
  id: SetupStepId
  /** Lo que tiene que hacer, como acción. */
  title: string
  /** En el menú, una línea. */
  short: string
  /** Por qué importa: qué gana su agente con esto. */
  why: string
  /** Cómo hacerlo bien, en concreto. */
  tips: string[]
  href: string
  cta: string
  done: boolean
  optional?: boolean
}

/** Rubros que venden productos (carta, catálogo) en vez de agendar horas. */
const SELLS_PRODUCTS = new Set(['gastronomia', 'ecommerce'])

const MIN_TEXT = 40
const MIN_KNOWLEDGE = 3

/** Hay texto suficiente para que el agente sepa de qué trata el negocio. */
function filled(value: string): boolean {
  return value.trim().length >= MIN_TEXT
}

export function getSetupSteps(businessId: string, f: SetupFacts): SetupStep[] {
  const base = `/panel/${businessId}`
  const template = getIndustryTemplate(f.templateId)
  const sells = SELLS_PRODUCTS.has(f.templateId)
  const hints = template?.knowledgeHints ?? []

  // Al crear el negocio ya se pidió el nombre, el tono y el objetivo, y la descripción parte de la
  // plantilla del rubro: el perfil queda hecho desde el principio y este paso es para revisarlo.
  const perfilDone = filled(f.description) && filled(f.goals)

  const operacion: SetupStep = sells
    ? {
        id: 'operacion',
        title: 'Sube tu carta o catálogo',
        short: 'Productos, precios y stock',
        why: 'Con tu carta cargada, el agente responde precios exactos, recomienda, toma el pedido, calcula el total y descuenta el stock. Sin ella solo puede anotar lo que le piden.',
        tips: [
          'Agrega cada producto con su precio. El stock es opcional: si lo pones, el agente avisa cuando algo se agota.',
          'Si vendes en WooCommerce o Jumpseller, puedes importar el catálogo en un clic.',
          ...(f.templateId === 'gastronomia'
            ? ['¿Tienes mesas? En «Mesas y reservas» dibuja tu local y el agente también reserva.']
            : []),
        ],
        href: `${base}/pedidos`,
        cta: 'Cargar mi carta',
        done: f.productCount > 0,
      }
    : {
        id: 'operacion',
        title: 'Carga tus servicios y horarios',
        short: 'Lo que agenda y cuánto dura',
        why: 'Así el agente mira tu disponibilidad real y agenda horas solo, sin topes ni dobles reservas. Tú solo ves la hora lista en tu agenda.',
        tips: [
          'Crea cada servicio con su duración y precio (ej: «Semipermanente · 60 min · $15.000»).',
          'Revisa los días y horas en que atiendes.',
          'Si atienden varias personas, agrégalas: el cliente puede elegir con quién.',
        ],
        href: `${base}/agenda`,
        cta: 'Cargar mis servicios',
        done: f.serviceCount > 0,
      }

  return [
    {
      id: 'perfil',
      title: 'Cuéntale a tu agente quién es',
      short: 'Nombre, tono y qué debe lograr',
      why: 'Con esto sabe cómo presentarse, cómo hablarle a tus clientes y qué buscar en cada conversación: agendar, vender o reservar.',
      tips: [
        'Ponle nombre de persona (Camila, Rodri…): los clientes conversan más tranquilos.',
        'Describe tu negocio como se lo contarías a alguien nuevo: qué haces, dónde estás, qué te diferencia.',
        'En «Qué tiene que lograr» escribe lo que harías tú: saludar, recomendar, cerrar la hora o el pedido.',
        'Elige el tono: cercano, formal o directo.',
      ],
      href: `${base}/configurar`,
      cta: 'Configurar mi agente',
      done: perfilDone,
    },
    {
      id: 'conocimiento',
      title: 'Enséñale lo que tiene que saber',
      short: 'Precios, horarios, dirección, dudas',
      why: 'Tu agente responde solo con lo que le enseñas aquí. Lo que no sepa, no lo inventa: dice que lo confirma. Mientras más le cuentes, más resuelve sin ti.',
      tips: [
        ...(hints.length > 0 ? [`Para tu rubro conviene cargar: ${hints.slice(0, 4).join(', ').toLowerCase()}.`] : []),
        'Una ficha por tema: «Horarios», «Dirección y estacionamiento», «Formas de pago», «Preguntas frecuentes».',
        'Puedes importar la información desde tu sitio web.',
      ],
      href: `${base}/conocimiento`,
      cta: 'Enseñarle a mi agente',
      done: f.knowledgeCount >= MIN_KNOWLEDGE,
    },
    operacion,
    {
      id: 'prueba',
      title: 'Pruébalo tú primero',
      short: 'Chatea con él como si fueras cliente',
      why: 'Antes de que hable con tus clientes, conversa tú con él en el simulador. Si algo no te gusta, ajusta lo que sabe o cómo habla y vuelve a probar.',
      tips: [
        'Aprieta «+ Probar conversación» y escríbele como lo haría un cliente: «hola, ¿tienen hora mañana?».',
        'Pregúntale precios, horarios y algo que no le enseñaste: fíjate que no invente.',
      ],
      href: base,
      cta: 'Ir a probarlo',
      done: f.simulatorCount > 0,
    },
    {
      id: 'canal',
      title: 'Conéctalo a tu WhatsApp o Instagram',
      short: 'Dónde atiende a tus clientes',
      why: 'Desde ese momento responde a tus clientes reales, de día y de noche. Tú ves todas las conversaciones aquí y puedes tomar cualquiera cuando quieras.',
      tips: [
        'Cada canal trae su guía paso a paso.',
        '¿Prefieres no hacerlo tú? Con la implementación lo dejamos conectado y verificado ante Meta.',
      ],
      href: `${base}/conexiones`,
      cta: 'Conectar mis canales',
      done: f.whatsappConnected || f.instagramConnected,
    },
    {
      id: 'logo',
      title: 'Sube tu logo',
      short: 'Para reconocer tu negocio',
      why: 'Así identificas tu negocio de un vistazo en el panel, sobre todo si manejas más de uno.',
      tips: ['Una imagen cuadrada en PNG o JPG.'],
      href: `${base}/configurar`,
      cta: 'Subir mi logo',
      done: f.hasLogo,
      optional: true,
    },
  ]
}

export interface SetupProgress {
  steps: SetupStep[]
  required: number
  completed: number
  /** El primer paso obligatorio pendiente: lo que conviene hacer ahora. */
  next: SetupStep | null
  ready: boolean
}

export function getSetupProgress(businessId: string, facts: SetupFacts): SetupProgress {
  const steps = getSetupSteps(businessId, facts)
  const required = steps.filter((s) => !s.optional)
  const completed = required.filter((s) => s.done).length
  const next = required.find((s) => !s.done) ?? null
  return {
    steps,
    required: required.length,
    completed,
    next,
    ready: next === null,
  }
}
