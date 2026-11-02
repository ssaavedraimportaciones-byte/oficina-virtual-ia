/**
 * Lo que la landing muestra como prueba. Regla: acá solo va lo que se puede
 * comprobar. Los números de demostración están conectados de verdad y
 * contestan con el mismo agente que se vende; las cifras salen de medir
 * respuestas reales en producción. Nada de testimonios ni métricas inventadas:
 * cuando haya clientes que autoricen publicar sus resultados, se suman acá.
 */

export interface DemoBot {
  id: string
  emoji: string
  name: string
  rubro: string
  /** Número tal como se muestra. */
  phone: string
  /** Qué conviene pedirle para ver lo mejor del agente en ese rubro. */
  tryIt: string[]
  /** Primer mensaje que queda escrito al abrir WhatsApp. */
  greeting: string
}

export const DEMO_BOTS: DemoBot[] = [
  {
    id: 'glam',
    emoji: '💅',
    name: 'Studio Glam',
    rubro: 'Uñas y depilación',
    phone: '+56 9 3663 6559',
    tryIt: ['Pide una hora para mañana', 'Pide que te atienda Camila', 'Pregunta cuánto sale el semipermanente'],
    greeting: 'Hola, quiero agendar una hora',
  },
  {
    id: 'altura',
    emoji: '🍽️',
    name: 'Altura Bistró',
    rubro: 'Restaurante',
    phone: '+56 9 4893 4972',
    tryIt: ['Reserva una mesa junto a la ventana', 'Pide sombra para el almuerzo', 'Pregunta qué se ve desde la terraza'],
    greeting: 'Hola, quiero reservar una mesa',
  },
  {
    id: 'pancho',
    emoji: '🌭',
    name: 'Pancho Rodante',
    rubro: 'Food truck',
    phone: '+56 9 3485 0293',
    tryIt: ['Pide la carta', 'Haz un pedido para retirar', 'Pregunta si queda algo agotado'],
    greeting: 'Hola, ¿qué tienen hoy?',
  },
]

export function waLink(bot: DemoBot): string {
  return `https://wa.me/${bot.phone.replace(/\D/g, '')}?text=${encodeURIComponent(bot.greeting)}`
}

/**
 * Medido sobre respuestas reales de los agentes en producción (tiempo entre el
 * último mensaje del cliente y la respuesta). Actualizar con la fecha al
 * volver a medir.
 */
export const MEASURED = {
  medianSeconds: '3,3',
  sample: 38,
  measuredOn: 'noviembre de 2026',
}
