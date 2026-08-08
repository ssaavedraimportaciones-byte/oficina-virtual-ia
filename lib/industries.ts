import type { Tone } from './types'

export interface IndustryTemplate {
  id: string
  label: string
  emoji: string
  industry: string
  description: string
  goals: string
  tone: Tone
  /** Qué conviene cargar en la base de conocimiento para este rubro. */
  knowledgeHints: string[]
}

/**
 * Plantillas por rubro: precargan el configurador para que un negocio nuevo
 * arranque en un clic en vez de escribir todo de cero. No son categorías
 * cerradas — el rubro es texto libre y cualquiera de estos campos se puede
 * editar después, así que un rubro que no esté acá igual funciona.
 */
export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    id: 'manicura',
    label: 'Manicura / Uñas',
    emoji: '💅',
    industry: 'Manicura, esculpidas y esmaltado semipermanente',
    description:
      'Estudio de uñas. Trabajamos con turnos previos, atendemos en local y ofrecemos distintos servicios de manicura y decoración.',
    goals:
      'Averiguar qué servicio quiere (semipermanente, esculpidas, retiro, kapping), pasarle el precio, y cerrar el turno con día y horario concreto. Si pregunta por diseños, contarle qué opciones hay.',
    tone: 'cercano',
    knowledgeHints: [
      'Lista de precios por servicio',
      'Días y horarios de atención',
      'Dirección del local y cómo llegar',
      'Política de señas y cancelaciones',
      'Duración aproximada de cada servicio',
    ],
  },
  {
    id: 'odontologia',
    label: 'Odontología',
    emoji: '🦷',
    industry: 'Consultorio odontológico',
    description:
      'Consultorio dental. Atendemos consultas generales, limpieza, arreglos, ortodoncia y urgencias, con turno previo.',
    goals:
      'Entender qué necesita (control, dolor, urgencia, estética, ortodoncia), si tiene obra social o es particular, y agendar el turno. Si es una urgencia con dolor, priorizarla y avisar al equipo.',
    tone: 'formal',
    knowledgeHints: [
      'Obras sociales y prepagas que se aceptan',
      'Precios de consulta y tratamientos particulares',
      'Horarios de atención y profesionales',
      'Dirección del consultorio',
      'Cómo se manejan las urgencias',
    ],
  },
  {
    id: 'taller',
    label: 'Taller mecánico',
    emoji: '🔧',
    industry: 'Taller mecánico y service de automóviles',
    description:
      'Taller mecánico. Hacemos service, diagnóstico, reparaciones y mantenimiento general de vehículos.',
    goals:
      'Averiguar marca, modelo y año del vehículo, y qué problema tiene o qué service necesita. Dar una idea de precio si el trabajo está en la lista, y coordinar día para que lo traiga al taller.',
    tone: 'directo',
    knowledgeHints: [
      'Precios de service por tipo de vehículo',
      'Trabajos que se hacen y cuáles no',
      'Días y horarios, y cuánto demora cada trabajo',
      'Dirección del taller',
      'Si se entregan presupuestos sin cargo',
    ],
  },
  {
    id: 'peluqueria',
    label: 'Peluquería / Barbería',
    emoji: '💈',
    industry: 'Peluquería y barbería',
    description:
      'Peluquería. Cortes, color, tratamientos y peinados, con turno previo.',
    goals:
      'Saber qué servicio busca y con qué profesional si tiene preferencia, pasarle el precio y cerrar día y horario del turno.',
    tone: 'cercano',
    knowledgeHints: [
      'Lista de precios por servicio',
      'Profesionales y sus especialidades',
      'Horarios de atención',
      'Dirección del local',
    ],
  },
  {
    id: 'inmobiliaria',
    label: 'Inmobiliaria',
    emoji: '🏠',
    industry: 'Inmobiliaria, venta y alquiler de propiedades',
    description:
      'Inmobiliaria. Vendemos y alquilamos propiedades, atendemos particulares e inversores.',
    goals:
      'Calificar si busca comprar o alquilar, en qué zona, qué tipo de propiedad y con qué presupuesto. Con eso, coordinar una visita con el equipo.',
    tone: 'formal',
    knowledgeHints: [
      'Propiedades disponibles con precio y zona',
      'Requisitos para alquilar (garantía, recibos)',
      'Comisiones y gastos',
      'Zonas en las que se opera',
    ],
  },
  {
    id: 'gastronomia',
    label: 'Gastronomía',
    emoji: '🍽️',
    industry: 'Restaurante / bar',
    description:
      'Restaurante. Atendemos en salón, tomamos reservas y hacemos pedidos para llevar.',
    goals:
      'Resolver consultas de carta, precios y horarios, y tomar la reserva con fecha, horario y cantidad de personas. Si pregunta por delivery o eventos, derivarlo bien.',
    tone: 'cercano',
    knowledgeHints: [
      'Carta con precios',
      'Horarios y días que abre',
      'Dirección y si hay estacionamiento',
      'Opciones sin TACC / vegetarianas / veganas',
      'Cómo se manejan reservas y eventos',
    ],
  },
  {
    id: 'gimnasio',
    label: 'Gimnasio / Entrenamiento',
    emoji: '🏋️',
    industry: 'Gimnasio y entrenamiento personal',
    description:
      'Gimnasio. Ofrecemos musculación, clases grupales y planes de entrenamiento.',
    goals:
      'Entender qué objetivo tiene (bajar de peso, ganar masa, salud general), pasarle los planes y precios, e invitarlo a una clase de prueba o a pasar por el local.',
    tone: 'cercano',
    knowledgeHints: [
      'Planes y precios de cuotas',
      'Clases y horarios',
      'Si hay clase de prueba gratis',
      'Dirección y horarios de la sede',
    ],
  },
  {
    id: 'estudio-juridico',
    label: 'Estudio jurídico',
    emoji: '⚖️',
    industry: 'Estudio jurídico',
    description:
      'Estudio de abogados. Asesoramos y llevamos casos en distintas áreas del derecho.',
    goals:
      'Entender de qué tema legal se trata y si es un área que el estudio maneja, sin dar asesoramiento legal por chat. Coordinar una primera consulta con un abogado del equipo.',
    tone: 'formal',
    knowledgeHints: [
      'Áreas del derecho que se atienden',
      'Costo de la primera consulta',
      'Horarios de atención y modalidad (presencial / virtual)',
      'Dirección del estudio',
    ],
  },
  {
    id: 'ecommerce',
    label: 'Tienda / E-commerce',
    emoji: '🛍️',
    industry: 'Venta de productos, tienda online y local',
    description:
      'Tienda. Vendemos productos por redes y online, con envíos y retiro en el local.',
    goals:
      'Saber qué producto busca, confirmarle precio y disponibilidad, explicar formas de pago y envío, y cerrar la venta o pasarle el link de compra.',
    tone: 'cercano',
    knowledgeHints: [
      'Catálogo con precios y stock',
      'Formas de pago y si hay cuotas',
      'Costos y plazos de envío',
      'Política de cambios y devoluciones',
    ],
  },
  {
    id: 'otro',
    label: 'Otro rubro',
    emoji: '✨',
    industry: '',
    description: '',
    goals: '',
    tone: 'cercano',
    knowledgeHints: [
      'Lista de precios o servicios',
      'Horarios de atención',
      'Dirección o zona de cobertura',
      'Preguntas frecuentes de tus clientes',
    ],
  },
]

export function getIndustryTemplate(id: string): IndustryTemplate | undefined {
  return INDUSTRY_TEMPLATES.find((t) => t.id === id)
}
