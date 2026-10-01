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
    kicker: 'Cierras el local',
    title: 'Alguien te escribe justo cuando ya no estás.',
    body: 'El local está cerrado y tú, descansando. Antes ese mensaje esperaba hasta mañana. Ahora ZeroVisto responde en el momento, con lo que tú le cargaste.',
    vertical: 'Llega',
  },
  {
    id: 'agenda',
    minutes: 23 * 60 + 52,
    time: '23:52',
    kicker: 'Una hora, agendada',
    title: 'Mira tu agenda de verdad y deja la hora reservada.',
    body: 'Consulta tus horarios y la duración de cada servicio, ofrece solo las horas libres y agenda sin pisar otra. La hora queda en tu panel, no en una libreta.',
    vertical: 'Agenda',
    shot: {
      src: '/landing/agenda-recorte.webp',
      alt: 'Panel de Agenda de ZeroVisto con una hora reservada: Ana, semipermanente, martes 6/10/2026 a las 15:00, 60 minutos.',
      caption: 'Agenda · tu panel',
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
    title: 'Vende lo que tienes y descuenta el stock.',
    body: 'Consulta tu catálogo, confirma precio y disponibilidad, registra el pedido a nombre del cliente y baja el stock. Solo afirma lo que tú cargaste.',
    vertical: 'Vende',
    shot: {
      src: '/landing/pedidos-recorte.webp',
      alt: 'Panel de Catálogo y pedidos: esmalte semipermanente a $4.500 con stock 10 y el pedido de Ana, 2 unidades, total $9.000.',
      caption: 'Catálogo y pedidos · tu panel',
      width: 1100,
      height: 740,
      ring: { left: 1.4, top: 62, width: 96.4, height: 30 },
    },
  },
  {
    id: 'persona',
    minutes: 26 * 60 + 31,
    time: '02:31',
    kicker: 'Una persona, por favor',
    title: 'Cuando el cliente se molesta, el agente no insiste: te avisa.',
    body: 'Si reclama o pide hablar con alguien, el agente se pausa, le cuenta que una persona lo va a atender y te manda un mail con el motivo. La conversación sigue con tu equipo, desde el panel.',
    vertical: 'Avisa',
    shot: {
      src: '/landing/conversacion.webp',
      alt: 'Conversación de Ana en el panel: agente pausado con la etiqueta «Atiende una persona», el motivo de la derivación y la ficha del cliente.',
      caption: 'Conversaciones · tu panel',
      width: 1600,
      height: 1000,
      ring: { left: 16.6, top: 8, width: 63.6, height: 3.8 },
    },
  },
  {
    id: 'amanece',
    minutes: 32 * 60 + 5,
    time: '08:05',
    kicker: 'Amaneces',
    title: 'Te despiertas con todo hecho. Y el caso difícil, en tus manos.',
    body: 'Abres el resumen: la hora agendada, el pedido registrado, los mensajes de la noche. Respondes el reclamo desde el panel y, cuando quieras, le devuelves la conversación al agente.',
    vertical: 'Amanece',
    shot: {
      src: '/landing/resumen.webp',
      alt: 'Resumen del panel: 1 conversación, 13 mensajes, 6 de 300 respuestas del agente este mes en el plan gratis, 1 hora agendada y 1 pedido por $9.000.',
      caption: 'Resumen · tu panel',
      width: 1600,
      height: 1000,
      ring: { left: 18.8, top: 32.5, width: 19.1, height: 12.6 },
    },
  },
]

export const DEMO_NOTE = 'Capturas del panel con datos de demostración · negocio ficticio «Uñas Bella»'

export const HANDOFF_SUBJECT = 'Ana necesita que le responda una persona — Uñas Bella'
