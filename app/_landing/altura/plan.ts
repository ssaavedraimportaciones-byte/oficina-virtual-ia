/**
 * El salón de ejemplo de Altura Bistró (piso 11), en coordenadas del croquis
 * (400 x 300). Lo usan el dibujo 2D y la escena 3D, así las dos muestran las
 * mismas mesas en el mismo lugar. Es el mismo restaurante que quedó como
 * negocio de demostración.
 */

export const PLACE = { name: 'Altura Bistró', floor: 'Piso 11 · Salón', where: 'Las Condes', graceMinutes: 15 } as const

export type Tone = 'sol' | 'sombra' | 'libre' | 'tomada'

/** Hacia dónde mira la mesa: el ventanal de la torre, el de la cordillera, o el salón. */
export type Facing = 'torre' | 'cordillera' | 'salon'

export interface PlanTable {
  label: string
  x: number
  y: number
  /** Redonda: radio. Rectangular: ancho y alto. */
  r?: number
  w?: number
  h?: number
  tone: Tone
  facing: Facing
  seats: number
}

export const PLAN_W = 400
export const PLAN_H = 300

export const TABLES: PlanTable[] = [
  { label: '1', x: 60, y: 62, r: 20, tone: 'tomada', facing: 'torre', seats: 2 },
  { label: '2', x: 125, y: 62, r: 20, tone: 'sol', facing: 'torre', seats: 2 },
  { label: '3', x: 190, y: 62, r: 20, tone: 'sol', facing: 'torre', seats: 4 },
  { label: '5', x: 330, y: 70, w: 44, h: 40, tone: 'sombra', facing: 'cordillera', seats: 4 },
  { label: '6', x: 330, y: 130, w: 44, h: 54, tone: 'tomada', facing: 'cordillera', seats: 6 },
  { label: '8', x: 100, y: 150, r: 20, tone: 'libre', facing: 'salon', seats: 4 },
  { label: '9', x: 200, y: 150, r: 20, tone: 'libre', facing: 'salon', seats: 4 },
  { label: '10', x: 230, y: 230, w: 100, h: 36, tone: 'libre', facing: 'salon', seats: 8 },
]

/** La mesa que elige la clienta del chat de ejemplo. */
export const CHOSEN = '3'

/** Centro de la mesa en el croquis. */
export function tableCenter(t: PlanTable): { x: number; y: number } {
  return t.r ? { x: t.x, y: t.y } : { x: t.x + (t.w ?? 0) / 2, y: t.y + (t.h ?? 0) / 2 }
}

export const FACING_TEXT: Record<Facing, string> = {
  torre: 'junto al ventanal con vista a la Torre Titanium · lado sol',
  cordillera: 'junto al ventanal hacia la cordillera · lado sombra',
  salon: 'al centro del salón',
}
