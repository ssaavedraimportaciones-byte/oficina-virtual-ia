/**
 * Estado compartido entre el DOM (la línea de tiempo que sigue al scroll, el
 * conductor de secciones, el cursor) y el mundo 3D (que lo dibuja). Todo lo
 * que cambia en la escena vive acá: el mismo punto del scroll siempre muestra
 * lo mismo, hacia adelante o hacia atrás.
 */
export const bus = {
  /** Portada: 0 = cielo, 1 = la cámara ya bajó a la calle. */
  hero: 0,
  /** Plano dentro de la noche: 0 cuadra · 1 vitrina · 2 estante · 3 lluvia · 4 amanecer. */
  cam: 0,
  /** Después de la noche: avance 5..10 (rubros, vista aérea, cordillera, atardecer, noche). 0 = todavía no. */
  post: 0,
  dawn: 0,
  rain: 0,
  /** Luz del local: baja cuando está cerrado, sube cuando el agente está respondiendo. */
  shop: 0.3,
  /** Luz de la pieza de Caro, la dueña. */
  owner: 1,
  /** Pantalla del celular de Caro (el aviso por correo). */
  ownerPhone: 0,
  /** Pantalla del celular de Ana. */
  anaPhone: 0,
  /** Frascos de esmalte vendidos (0 a 2). */
  sold: 0,
  /** Avance de cada mensaje en vuelo (0 = en su origen, 1 = llegó). */
  fl: {} as Record<string, number>,
  /** Letreros encendidos en la calle de rubros (0 a 9, con decimales para el fundido). */
  signs: 0,
  /** Haces de luz de la vista aérea (0 a 1). */
  beams: 0,
  /**
   * Escena del carro de completos, amarrada a la conversación del ejemplo food
   * truck: segundo en que va (0 = no empieza) y en qué segundo aparece cada
   * mensaje y de quién es. La pone motion.ts; la dibuja world/foodtruck.ts.
   */
  truck: { t: 0, msgAt: [] as number[], who: [] as string[] },
  /** Carga del mundo, para la precarga (0 a 1). */
  load: 0,
  /** Lo que está bajo el mouse en la escena ('' si nada). */
  hover: '',
}
