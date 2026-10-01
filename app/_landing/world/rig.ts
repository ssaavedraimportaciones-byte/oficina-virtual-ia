import * as THREE from 'three'

/**
 * Guion de cámara de toda la página. `u` avanza con el scroll:
 *   0 portada · 1-5 la noche (cuadra, vitrina, estante, lluvia, amanecer)
 *   6-6.9 calle de rubros · 7 vista aérea · 8 cordillera · 9 atardecer · 10 de vuelta a la noche
 * Cada punto es un plano compuesto a mano, en dos versiones: pantalla ancha y
 * pantalla alta (celular), que se aleja y abre el lente en vez de recortar.
 */
interface Shot {
  u: number
  pos: [number, number, number]
  tgt: [number, number, number]
  fov: number
}

const WIDE: Shot[] = [
  { u: 0, pos: [4, 15, 48], tgt: [-4, 19, -200], fov: 40 },
  { u: 1, pos: [0, 3.6, 18.5], tgt: [0, 5.2, -9], fov: 38 },
  { u: 2, pos: [-2.4, 2.3, 6.2], tgt: [0.3, 2.6, -9], fov: 36 },
  { u: 3, pos: [1.2, 2.15, 1.6], tgt: [0, 2.2, -6], fov: 34 },
  { u: 4, pos: [-3.2, 1.7, 16], tgt: [2.2, 6.4, -9], fov: 40 },
  { u: 5, pos: [2, 19, 40], tgt: [10, 26, -220], fov: 40 },
  // Calle de rubros: la cámara va ~12 m detrás del local que se enciende, así el letrero activo
  // cae en el tercio derecho (la columna de texto está a la izquierda). Ver `bus.signs` en motion.ts.
  { u: 6, pos: [-2, 2.5, 7.4], tgt: [4.7, 3.5, -5.5], fov: 44 },
  { u: 6.9, pos: [64.1, 2.5, 7.4], tgt: [70.8, 3.5, -5.5], fov: 44 },
  // Vista aérea: la calle queda en la mitad izquierda; la derecha es de la columna de texto
  { u: 7, pos: [80.3, 52, 30.4], tgt: [76.4, 0, -6], fov: 42 },
  { u: 8, pos: [36, 14, 32], tgt: [10, 34, -320], fov: 42 },
  { u: 9, pos: [-9, 9, 30], tgt: [2, 5.5, -9], fov: 40 },
  { u: 10, pos: [0, 3.4, 19.5], tgt: [0, 5.4, -9], fov: 38 },
]

const TALL: Shot[] = [
  { u: 0, pos: [0, 15, 52], tgt: [-8, 20, -200], fov: 52 },
  { u: 1, pos: [-2.8, 5, 25], tgt: [-2.8, 5.6, -9], fov: 50 },
  { u: 2, pos: [-0.8, 2.6, 9.5], tgt: [0, 2.7, -9], fov: 50 },
  { u: 3, pos: [0.4, 2.3, 4.4], tgt: [0, 2.25, -6], fov: 50 },
  { u: 4, pos: [3.2, 3.4, 28], tgt: [3.2, 6.6, -9], fov: 50 },
  { u: 5, pos: [0, 22, 44], tgt: [6, 25, -220], fov: 52 },
  { u: 6, pos: [9.6, 3, 8.6], tgt: [9.6, 3.8, -5.5], fov: 62 },
  { u: 6.9, pos: [76.8, 3, 8.6], tgt: [76.8, 3.8, -5.5], fov: 62 },
  // En el celular las tarjetas ocupan el centro: la cámara levanta la vista y la calle queda abajo
  { u: 7, pos: [43, 52, 46], tgt: [43, 26.6, -8.4], fov: 52 },
  { u: 8, pos: [30, 14, 36], tgt: [10, 34, -320], fov: 52 },
  { u: 9, pos: [-4, 10, 36], tgt: [1, 5.5, -9], fov: 52 },
  { u: 10, pos: [-1.5, 4.6, 27], tgt: [-1.5, 5.6, -9], fov: 50 },
]

const v3 = (a: [number, number, number]) => new THREE.Vector3(...a)
const compile = (shots: Shot[]) => shots.map((s) => ({ u: s.u, pos: v3(s.pos), tgt: v3(s.tgt), fov: s.fov }))
const RIGS = { wide: compile(WIDE), tall: compile(TALL) }

/** Posición, objetivo y lente de la cámara en `u`. */
export function sampleRig(u: number, tall: boolean, pos: THREE.Vector3, tgt: THREE.Vector3): number {
  const rig = tall ? RIGS.tall : RIGS.wide
  const last = rig.length - 1
  if (u <= rig[0].u) {
    pos.copy(rig[0].pos)
    tgt.copy(rig[0].tgt)
    return rig[0].fov
  }
  if (u >= rig[last].u) {
    pos.copy(rig[last].pos)
    tgt.copy(rig[last].tgt)
    return rig[last].fov
  }
  let i = 0
  while (i < last - 1 && u > rig[i + 1].u) i += 1
  const a = rig[i]
  const b = rig[i + 1]
  const raw = (u - a.u) / (b.u - a.u)
  // Llegada y salida suaves en cada plano: la cámara "se asienta".
  const t = raw * raw * (3 - 2 * raw)
  // Interpolación directa entre planos compuestos: sin la sobrecurva de un spline,
  // que con vecinos lejanos (la grúa del amanecer, la vista aérea) hundía la cámara.
  pos.copy(a.pos).lerp(b.pos, t)
  tgt.copy(a.tgt).lerp(b.tgt, t)
  return a.fov + (b.fov - a.fov) * t
}

/** Hora del día según el avance de la página (ver palette.ts). En la noche la manda la línea de tiempo. */
export function timeOfDay(u: number, nightDawn: number): number {
  if (u <= 5) return nightDawn
  const keys: [number, number][] = [
    [5, 1],
    [6, 1.65],
    [6.9, 2],
    [7, 2],
    [8, 2.55],
    [9, 3],
    [10, 4],
  ]
  for (let i = 0; i < keys.length - 1; i += 1) {
    const [u0, t0] = keys[i]
    const [u1, t1] = keys[i + 1]
    if (u <= u1) return t0 + ((t1 - t0) * (u - u0)) / (u1 - u0)
  }
  return 4
}
