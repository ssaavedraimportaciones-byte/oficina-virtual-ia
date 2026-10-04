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

export interface StreetShop {
  /** id de la plantilla de rubro (lib/industries.ts) */
  id: string
  emoji: string
  label: string
  /** Qué hace el agente en ese rubro, en corto (resumen de la plantilla). */
  does: string
  sign: { text: string; sub?: string; kind: 'lightbox' | 'neon' | 'painted' | 'channel'; bg: string; fg: string; font?: 'sans' | 'serif' | 'script' }
  facade: string
  /** Color de la luz interior y del haz en la vista aérea. */
  glow: string
  floors: number
}

/** La calle de los rubros: un local por plantilla, en el orden en que pasa la cámara. */
export const STREET: StreetShop[] = [
  {
    id: 'odontologia',
    emoji: '🦷',
    label: 'Odontología',
    does: 'Entiende qué necesita el paciente, distingue una urgencia y agenda la hora.',
    sign: { text: 'DENTAL', sub: 'odontología', kind: 'lightbox', bg: '#f4f8fb', fg: '#1f6f8b' },
    facade: '#d9d4c8',
    glow: '#bfe8ff',
    floors: 2,
  },
  {
    id: 'taller',
    emoji: '🔧',
    label: 'Taller mecánico',
    does: 'Pregunta marca, modelo y año, da una idea de precio y coordina el día.',
    sign: { text: 'TALLER', sub: 'mecánica y frenos', kind: 'painted', bg: '#e2b03a', fg: '#1b1b1b' },
    facade: '#8f8a80',
    glow: '#ffb15c',
    floors: 1,
  },
  {
    id: 'peluqueria',
    emoji: '💈',
    label: 'Peluquería y barbería',
    does: 'Pregunta el servicio y con quién lo quiere, da el precio y agenda.',
    sign: { text: 'Barbería', kind: 'neon', bg: '#111', fg: '#ff5d73', font: 'script' },
    facade: '#3f4a56',
    glow: '#ffd2a8',
    floors: 3,
  },
  {
    id: 'inmobiliaria',
    emoji: '🏠',
    label: 'Inmobiliaria',
    does: 'Califica si busca comprar o arrendar, zona y presupuesto, y coordina la visita.',
    sign: { text: 'PROPIEDADES', sub: 'venta y arriendo', kind: 'lightbox', bg: '#1f2a44', fg: '#f2f2f2' },
    facade: '#b9b2a5',
    glow: '#fff2dc',
    floors: 2,
  },
  {
    id: 'gastronomia',
    emoji: '🍽️',
    label: 'Gastronomía',
    does: 'Responde carta, precios y horarios, y toma la reserva para cuántos y a qué hora.',
    sign: { text: 'La Picada', sub: 'almuerzos · once', kind: 'neon', bg: '#111', fg: '#ffb347', font: 'script' },
    facade: '#9c5b45',
    glow: '#ffc27a',
    floors: 1,
  },
  {
    id: 'gimnasio',
    emoji: '🏋️',
    label: 'Gimnasio',
    does: 'Entiende el objetivo, pasa planes y precios, e invita a una clase de prueba.',
    sign: { text: 'GIMNASIO', sub: 'entrenamiento', kind: 'channel', bg: '#111', fg: '#7cf0b0' },
    facade: '#2f3439',
    glow: '#d7e6ff',
    floors: 2,
  },
  {
    id: 'estudio-juridico',
    emoji: '⚖️',
    label: 'Estudio jurídico',
    does: 'Entiende el tema sin dar asesoría por chat y coordina la primera consulta.',
    sign: { text: 'Abogados', sub: 'estudio jurídico', kind: 'painted', bg: '#2b2220', fg: '#e8d2a0', font: 'serif' },
    facade: '#6e6458',
    glow: '#ffd89a',
    floors: 3,
  },
  {
    id: 'ecommerce',
    emoji: '🛍️',
    label: 'Tienda',
    does: 'Confirma precio y stock, explica pago y despacho, y cierra la venta.',
    sign: { text: 'TIENDA', sub: 'ropa y accesorios', kind: 'lightbox', bg: '#ffffff', fg: '#c2410c' },
    facade: '#e7e1d6',
    glow: '#fff0e0',
    floors: 1,
  },
  {
    id: 'otro',
    emoji: '✨',
    label: 'Tu negocio',
    does: 'Describes tu negocio con tus palabras y el agente se arma a su medida.',
    sign: { text: 'TU NEGOCIO', sub: 'el que sea', kind: 'channel', bg: '#111', fg: '#ffb347' },
    facade: '#4a4552',
    glow: '#ffcf8a',
    floors: 2,
  },
]

/** Centro (x) de cada local de la calle de rubros. */
export const streetX = (i: number) => 15.6 + i * 7

/** Datos del producto (no métricas de clientes): lo que trae ZeroVisto hoy. */
export const FACTS = [
  { value: '24/7', label: 'responde a cualquier hora' },
  { value: '2', label: 'canales: WhatsApp e Instagram' },
  { value: '10', label: 'plantillas de rubro' },
  { value: '1', label: 'panel para tu equipo' },
]

/** Capítulos del riel lateral: toda la página. */
export const RAIL = [
  { id: 'inicio', n: '00', label: 'Inicio' },
  { id: 'llega', n: '01', label: '23:47' },
  { id: 'agenda', n: '02', label: '23:52' },
  { id: 'venta', n: '03', label: '00:06' },
  { id: 'persona', n: '04', label: '02:31' },
  { id: 'amanece', n: '05', label: '08:05' },
  { id: 'rubros', n: '06', label: 'Rubros' },
  { id: 'negocios', n: '07', label: 'Negocios' },
  { id: 'limites', n: '08', label: 'Límites' },
  { id: 'empieza', n: '09', label: 'Empieza' },
  { id: 'final', n: '10', label: 'Esta noche' },
]

export const NAV = [
  { id: 'noche', label: 'Una noche' },
  { id: 'rubros', label: 'Rubros' },
  { id: 'negocios', label: 'Negocios' },
  { id: 'integraciones', label: 'Integraciones' },
  { id: 'empieza', label: 'Cómo empieza' },
]

export const STEPS = [
  { title: 'Elige tu rubro', text: 'El agente parte con el tono y las preguntas de tu tipo de negocio. Tú ajustas lo que quieras.' },
  {
    title: 'Cárgale tu información',
    text: 'Precios, horarios, servicios y productos. Es lo único que el agente puede afirmar, así que no inventa. Puedes importarla desde tu sitio o tu Instagram.',
  },
  { title: 'Conecta tus canales', text: 'Tu WhatsApp Business o tu Instagram. Antes lo pruebas en el simulador, escribiendo como si fueras el cliente.' },
  { title: 'Tú te dedicas a tu negocio', text: 'El agente atiende. Tú recibes las horas agendadas, los pedidos registrados y los casos que necesitan a una persona.' },
]

export const GUARDRAILS = [
  { title: 'No inventa', text: 'Solo afirma lo que cargaste: precios, horarios, servicios, stock. Si no lo sabe, lo dice o pasa el caso.' },
  { title: 'Se detiene cuando corresponde', text: 'Si el cliente reclama o pide una persona, el agente se pausa. Tú respondes desde el panel y se lo devuelves cuando quieras.' },
  { title: 'Tiene tope mensual', text: 'Cada plan incluye una cantidad de respuestas al mes y la ves en tu resumen. Si se agota, tu cliente recibe un aviso en vez de quedar en visto, y tú, un correo.' },
  { title: 'Si algo falla, avisa', text: 'Si la IA se cae o la plataforma entra en mantención, tu cliente recibe un mensaje claro. Sus mensajes quedan guardados para tu equipo.' },
]

export const MULTI = [
  { title: 'Cada negocio, lo suyo', text: 'Conversaciones, agenda, catálogo, canales y conocimiento viven separados por negocio. Lo de uno nunca se mezcla con lo de otro.' },
  { title: 'Dueños y equipo', text: 'Invita a tu gente con el rol que corresponde. El dueño administra; el equipo atiende las conversaciones.' },
  { title: 'Un solo ingreso', text: 'Si tienes más de un negocio, los ves todos desde la misma cuenta y cambias de uno a otro con un clic.' },
]

/**
 * Integraciones: la idea es que cada negocio conecte lo que ya usa para que la
 * atención sea completa. Honestidad ante todo (como el resto del landing): hoy
 * solo están conectados WhatsApp e Instagram (`live`); el resto es la hoja de
 * ruta, marcada «En camino» (`soon`). Son los servicios más usados en Chile.
 * Se nombran por su nombre (sin sus logos, para no usar marcas de terceros).
 */
export type IntegrationStatus = 'live' | 'soon'
export const INTEGRATIONS: { name: string; emoji: string; text: string; group: string; status: IntegrationStatus }[] = [
  { name: 'WhatsApp Business', emoji: '💬', text: 'Atiende donde ya te escriben.', group: 'Canales', status: 'live' },
  { name: 'Instagram', emoji: '📸', text: 'Responde los mensajes directos.', group: 'Canales', status: 'live' },
  { name: 'WooCommerce', emoji: '🧩', text: 'Importa tu catálogo y precios desde tu tienda WordPress.', group: 'Tienda', status: 'live' },
  { name: 'Jumpseller', emoji: '🛒', text: 'Importa productos, precios y stock desde tu tienda.', group: 'Tienda', status: 'live' },
  { name: 'Google Calendar', emoji: '📅', text: 'Agenda y bloquea las horas solo.', group: 'Agenda', status: 'soon' },
  { name: 'Google Sheets', emoji: '📊', text: 'Catálogo y datos en una planilla.', group: 'Agenda', status: 'soon' },
  { name: 'Bsale', emoji: '🧾', text: 'Boletas, stock y ventas al día.', group: 'Tienda', status: 'soon' },
  { name: 'Transbank Webpay', emoji: '💳', text: 'Cobros con tarjeta en el chat.', group: 'Pagos', status: 'soon' },
  { name: 'Mercado Pago', emoji: '🔗', text: 'Links de pago, sin salir de la conversación.', group: 'Pagos', status: 'soon' },
  { name: 'Flow', emoji: '🏦', text: 'Pagos y transferencias online.', group: 'Pagos', status: 'soon' },
  { name: 'Boleta electrónica (SII)', emoji: '📄', text: 'Documentos tributarios del cliente.', group: 'Documentos', status: 'soon' },
  { name: 'Notas de voz', emoji: '🎤', text: 'Procesa los audios que manda el cliente.', group: 'Documentos', status: 'soon' },
]
