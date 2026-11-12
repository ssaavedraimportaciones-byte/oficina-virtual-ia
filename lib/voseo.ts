/**
 * El agente tiene que hablar de tú, nunca de voseo (ni el rioplatense "tenés"
 * ni el chileno coloquial "tenís"). El prompt se lo pide con una regla
 * general, pero un modelo rápido no siempre la respeta al pie de la letra —
 * en producción salieron formas como "querís" u "ofrecés" que el prompt no
 * nombraba una por una. Esto es la última línea de defensa: un diccionario
 * CERRADO de formas puntuales que se corrigen en la respuesta antes de
 * mandarla, no un sufijo genérico ("-ás", "-és", "-ís"), porque eso
 * arruinaría palabras reales que terminan igual ("además", "jamás", "país",
 * "francés", "interés"...).
 *
 * No es exhaustivo (no puede serlo: hay miles de verbos). Cubre lo que
 * realmente se vio en el prompt, en el código y en respuestas reales. Si
 * aparece una forma nueva, se agrega acá.
 */
export const VOSEO_MAP: Record<string, string> = {
  vos: 'tú',
  sos: 'eres',

  tenés: 'tienes',
  tenís: 'tienes',
  tené: 'ten',
  podés: 'puedes',
  podís: 'puedes',
  querés: 'quieres',
  querís: 'quieres',
  sabés: 'sabes',
  sabís: 'sabes',
  hacés: 'haces',
  hacís: 'haces',
  decís: 'dices',
  decí: 'di',
  necesitás: 'necesitas',
  preferís: 'prefieres',
  elegís: 'eliges',
  elegí: 'elige',
  ponés: 'pones',
  poné: 'pon',
  venís: 'vienes',
  llegás: 'llegas',
  usás: 'usas',
  usá: 'usa',
  usalo: 'úsalo',
  cargás: 'cargas',
  cargá: 'carga',
  mirás: 'miras',
  confirmás: 'confirmas',
  confirmá: 'confirma',
  confirmale: 'confírmale',
  confirmalo: 'confírmalo',
  derivás: 'derivas',
  respondés: 'respondes',
  respondé: 'responde',
  mantenés: 'mantienes',
  ofrecés: 'ofreces',
  ofreís: 'ofreces',
  ofrecele: 'ofrécele',
  vendés: 'vendes',
  vendís: 'vendes',
  recibís: 'recibes',
  vivís: 'vives',
  pedís: 'pides',
  pedile: 'pídele',
  seguís: 'sigues',
  seguí: 'sigue',

  agregá: 'agrega',
  ajustá: 'ajusta',
  completá: 'completa',
  configurá: 'configura',
  consultá: 'consulta',
  copiá: 'copia',
  dejá: 'deja',
  devolvé: 'devuelve',
  escribí: 'escribe',
  escribilo: 'escríbelo',
  escribinos: 'escríbenos',
  escribís: 'escribes',
  esperá: 'espera',
  generá: 'genera',
  ignorá: 'ignora',
  ingresá: 'ingresa',
  iniciá: 'inicia',
  llamá: 'llama',
  pasá: 'pasa',
  pegá: 'pega',
  probá: 'prueba',
  registrá: 'registra',
  reintentá: 'reintenta',
  reservá: 'reserva',
  revisá: 'revisa',
  volvé: 'vuelve',

  decile: 'dile',
  decilo: 'dilo',
  preguntale: 'pregúntale',
  avisale: 'avísale',
  tomale: 'tómale',
  contale: 'cuéntale',
}

const LETTERS = 'A-Za-zñÑáéíóúÁÉÍÓÚ'

/** Expresión regular que detecta cualquier forma del diccionario, como palabra completa. */
export const VOSEO = new RegExp(
  `(?<![${LETTERS}])(${Object.keys(VOSEO_MAP).join('|')})(?![${LETTERS}])`,
  'gi',
)

function matchCase(original: string, replacement: string): string {
  if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1)
  }
  return replacement
}

/**
 * Corrige el voseo de una respuesta ya generada, palabra por palabra, sin
 * tocar el resto del texto. Devuelve el mismo texto si no encontró nada.
 */
export function fixVoseo(text: string): string {
  return text.replace(VOSEO, (match) => matchCase(match, VOSEO_MAP[match.toLowerCase()]))
}
