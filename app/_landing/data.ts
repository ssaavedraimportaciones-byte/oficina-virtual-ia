export type Who = 'contact' | 'agent' | 'human'

export interface Message {
  id: string
  who: Who
  text: string
  /** Capítulo (0-4) en el que aparece. */
  chapter: number
}

export interface Chapter {
  id: string
  /** Hora del reloj al empezar el capítulo, en minutos desde las 00:00 del día anterior. */
  minutes: number
  time: string
  kicker: string
  title: string
  body: string
  /** Palabra que se lee en vertical al costado. */
  vertical: string
  shot?: {
    src: string
    alt: string
    caption: string
    width: number
    height: number
    /** Recuadro que marca lo importante de la captura, en % de la imagen. */
    ring: { left: number; top: number; width: number; height: number }
  }
}

// Los mensajes son, palabra por palabra, los de la conversación de demostración
// que quedó guardada en el panel (negocio ficticio «Uñas Bella»).
export const MESSAGES: Message[] = [
  { id: 'm01', who: 'contact', chapter: 0, text: 'Hola!' },
  {
    id: 'm02',
    who: 'agent',
    chapter: 0,
    text: '¡Hola! Soy Bella, de Uñas Bella 💅 ¿En qué te puedo ayudar? Puedo darte precios, agendarte una hora o tomar un pedido de esmaltes.',
  },
  { id: 'm03', who: 'contact', chapter: 0, text: 'Hola, quiero agendar una hora para semipermanente el martes en la tarde' },
  {
    id: 'm04',
    who: 'agent',
    chapter: 0,
    text: 'Ya, el martes 6/10/2026 tengo estas horas en la tarde para semipermanente 💅\n• 14:00\n• 14:30\n• 15:00\n¿Cuál te acomoda más? Si me dices tu nombre te la dejo agendada.',
  },
  { id: 'm05', who: 'contact', chapter: 1, text: 'Ya, el martes a las 15:00. Me llamo Ana' },
  { id: 'm06', who: 'agent', chapter: 1, text: '¡Listo Ana! Quedó agendada tu hora de semipermanente 🎉 Te esperamos.' },
  { id: 'm07', who: 'contact', chapter: 2, text: 'Quiero comprar esmaltes' },
  {
    id: 'm08',
    who: 'agent',
    chapter: 2,
    text: 'Tengo esto 💅\n• Esmalte semipermanente: $4.500 — 12 en stock\n¿Cuántos quieres? Dime tu nombre y te lo registro.',
  },
  { id: 'm09', who: 'contact', chapter: 2, text: 'Me llevo dos esmaltes' },
  {
    id: 'm10',
    who: 'agent',
    chapter: 2,
    text: 'Anotado tu pedido 🛍️ A nombre de Ana: 2x Esmalte semipermanente ($9.000). Total $9.000. Te avisamos cuando esté listo.',
  },
  { id: 'm11', who: 'contact', chapter: 3, text: 'La última vez me cobraron de más y nadie me respondió, quiero hablar con alguien' },
  {
    id: 'm12',
    who: 'agent',
    chapter: 3,
    text: 'Lamento mucho lo que pasó, Ana. Le pasé tu caso al equipo y una persona te va a responder por acá al tiro.',
  },
  { id: 'm13', who: 'human', chapter: 4, text: 'Hola Ana, soy Caro del local. Ya revisé el cobro y te lo devolvemos hoy.' },
]

export const HANDOFF_REASON = 'Reclamo: le cobraron de más la última vez y pide hablar con una persona.'

export const CHAPTERS: Chapter[] = [
  {
    id: 'llega',
    minutes: 23 * 60 + 47,
    time: '23:47',
    kicker: 'Tu local ya cerró',
    title: 'Tu local cerró. Ana te escribe igual.',
    body: 'Antes ese mensaje esperaba hasta mañana. Ahora ZeroVisto le responde al tiro, con lo que tú le cargaste.',
    vertical: 'Llega',
  },
  {
    id: 'agenda',
    minutes: 23 * 60 + 52,
    time: '23:52',
    kicker: 'Una hora, agendada',
    title: 'Le agenda la hora. Sin pisar otra.',
    body: 'Mira tus horarios reales, ofrece solo horas libres y deja la reserva en tu agenda, no en una libreta.',
    vertical: 'Agenda',
    shot: {
      src: '/landing/agenda-recorte.webp',
      alt: 'Panel de Agenda de ZeroVisto con una hora reservada: Ana, semipermanente, martes 6/10/2026 a las 15:00, 60 minutos.',
      caption: 'Así queda en tu agenda',
      width: 1100,
      height: 506,
      ring: { left: 2.2, top: 66.5, width: 91.8, height: 23.5 },
    },
  },
  {
    id: 'venta',
    minutes: 24 * 60 + 6,
    time: '00:06',
    kicker: 'Una venta, registrada',
    title: 'Vende. Y descuenta el stock.',
    body: 'Confirma precio y disponibilidad, registra el pedido a nombre de Ana y baja el stock. Solo afirma lo que tú cargaste.',
    vertical: 'Vende',
    shot: {
      src: '/landing/pedidos-recorte.webp',
      alt: 'Panel de Catálogo y pedidos: esmalte semipermanente a $4.500 con stock 10 y el pedido de Ana, 2 unidades, total $9.000.',
      caption: 'Así queda en tus pedidos',
      width: 1100,
      height: 740,
      ring: { left: 1.4, top: 62, width: 96.4, height: 30 },
    },
  },
  {
    id: 'persona',
    minutes: 26 * 60 + 31,
    time: '02:31',
    kicker: 'Un reclamo',
    title: 'Un reclamo. El agente para y te avisa.',
    body: 'Se pausa, le dice a Ana que una persona la va a atender y te manda un correo con el motivo.',
    vertical: 'Avisa',
  },
  {
    id: 'amanece',
    minutes: 32 * 60 + 5,
    time: '08:05',
    kicker: 'Amanece',
    title: 'Amaneces con todo hecho. Tú solo respondes lo difícil.',
    body: 'Contestas el reclamo desde el panel. La hora y el pedido ya estaban listos.',
    vertical: 'Amanece',
    shot: {
      src: '/landing/conversacion.webp',
      alt: 'Conversación de Ana en el panel: agente pausado con la etiqueta «Atiende una persona», el motivo de la derivación, la respuesta de Caro y la ficha del cliente.',
      caption: 'Caro responde desde el panel',
      width: 1600,
      height: 1000,
      ring: { left: 16.6, top: 8, width: 63.6, height: 3.8 },
    },
  },
]

/** El resumen del panel, que se ve al final de la noche. */
export const SUMMARY_SHOT = {
  src: '/landing/resumen.webp',
  alt: 'Resumen del panel: 1 conversación, 13 mensajes, 6 de 300 respuestas del agente este mes en el plan gratis, 1 hora agendada y 1 pedido por $9.000.',
  caption: 'Tu resumen de la mañana',
  width: 1600,
  height: 1000,
  ring: { left: 18.8, top: 32.5, width: 19.1, height: 12.6 },
}

export type Place = 'ana' | 'shop' | 'owner'

export interface Flight {
  id: string
  from: Place
  to: Place
  kind: Who | 'mail'
  /** Quién firma la burbuja. */
  label: string
  text: string
}

const msg = (id: string) => MESSAGES.find((m) => m.id === id)!.text

/** Los mensajes que viajan entre las ventanas de la cuadra, en orden. */
export const FLIGHTS: Flight[] = [
  { id: 'f1', from: 'ana', to: 'shop', kind: 'contact', label: 'Ana', text: msg('m03') },
  { id: 'f2', from: 'shop', to: 'ana', kind: 'agent', label: 'Uñas Bella · responde ZeroVisto', text: msg('m04') },
  { id: 'f3', from: 'ana', to: 'shop', kind: 'contact', label: 'Ana', text: msg('m05') },
  { id: 'f4', from: 'shop', to: 'ana', kind: 'agent', label: 'Uñas Bella · responde ZeroVisto', text: msg('m06') },
  { id: 'f5', from: 'ana', to: 'shop', kind: 'contact', label: 'Ana', text: msg('m09') },
  { id: 'f6', from: 'shop', to: 'ana', kind: 'agent', label: 'Uñas Bella · responde ZeroVisto', text: msg('m10') },
  { id: 'f7', from: 'ana', to: 'shop', kind: 'contact', label: 'Ana', text: msg('m11') },
  { id: 'f8', from: 'shop', to: 'ana', kind: 'agent', label: 'Uñas Bella · responde ZeroVisto', text: msg('m12') },
  { id: 'f9', from: 'shop', to: 'owner', kind: 'mail', label: 'Correo para Caro', text: '' },
  { id: 'f10', from: 'owner', to: 'ana', kind: 'human', label: 'Caro, la dueña', text: msg('m13') },
]

export const DEMO_NOTE = 'Capturas del panel con datos de demostración · negocio ficticio «Uñas Bella»'

export const HANDOFF_SUBJECT = 'Ana necesita que le responda una persona — Uñas Bella'
