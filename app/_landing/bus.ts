/**
 * Estado compartido entre el escenario (la línea de tiempo que sigue al scroll)
 * y el mundo 3D (que lo dibuja). Todo lo que cambia en la escena vive acá, así
 * el mismo punto del scroll siempre muestra lo mismo, hacia adelante o atrás.
 */
export const bus = {
  /** Portada: 0 = cielo, 1 = la cámara ya bajó a la calle. */
  hero: 0,
  /** Plano de cámara dentro de la noche: 0 = la cuadra, 1 = vitrina, 2 = estante, 3 = lluvia, 4 = amanecer. */
  cam: 0,
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
}
