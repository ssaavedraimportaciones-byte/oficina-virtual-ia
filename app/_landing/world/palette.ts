import * as THREE from 'three'

/**
 * La luz del día como una sola perilla: 0 noche · 1 amanecer · 2 día ·
 * 3 atardecer · 4 noche otra vez. Todo lo que depende de la hora (cielo,
 * niebla, sol, faroles, ventanas) se lee de acá, interpolado.
 */
export interface Light {
  skyTop: THREE.Color
  skyMid: THREE.Color
  skyHorizon: THREE.Color
  fog: THREE.Color
  fogDensity: number
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  hemi: number
  /** Luz del sol (o de la luna) que da forma y sombras. */
  key: THREE.Color
  keyIntensity: number
  /** Altura del sol: -1 bajo el horizonte, 1 arriba. */
  sunHeight: number
  moon: number
  stars: number
  /** Faroles, letreros y ventanas encendidas. */
  lamps: number
  windows: number
  /** Tinte de la cordillera (nieve rosada al amanecer). */
  ridge: THREE.Color
  exposure: number
  /** Reflejos de calle mojada y neblina baja. */
  wet: number
  mist: number
}

const C = (hex: string) => new THREE.Color(hex)

const NIGHT: Light = {
  skyTop: C('#03050c'),
  skyMid: C('#0a1226'),
  skyHorizon: C('#142141'),
  fog: C('#0a1122'),
  fogDensity: 0.005,
  hemiSky: C('#4d6aa8'),
  hemiGround: C('#1a1410'),
  hemi: 0.55,
  key: C('#8fa6e8'),
  keyIntensity: 0.5,
  sunHeight: -1,
  moon: 1,
  stars: 1,
  lamps: 1,
  windows: 1,
  ridge: new THREE.Color(1, 1, 1),
  exposure: 1,
  wet: 1,
  mist: 1,
}

const DAWN: Light = {
  skyTop: C('#1b2347'),
  skyMid: C('#7b4a6c'),
  skyHorizon: C('#ffb36b'),
  fog: C('#6d4a5c'),
  fogDensity: 0.0036,
  hemiSky: C('#c58a86'),
  hemiGround: C('#3a2a22'),
  hemi: 0.85,
  key: C('#ffb27a'),
  keyIntensity: 1.1,
  sunHeight: 0.05,
  moon: 0.2,
  stars: 0,
  lamps: 0.35,
  windows: 0.55,
  ridge: new THREE.Color(1.9, 1.25, 1.05),
  exposure: 1,
  wet: 0.6,
  mist: 0.8,
}

// Día de Santiago: cielo azul que se pone lechoso hacia el horizonte (el smog).
const DAY: Light = {
  skyTop: C('#3f6fb4'),
  skyMid: C('#8db0d6'),
  skyHorizon: C('#d8d6cc'),
  fog: C('#b8bcc2'),
  fogDensity: 0.0042,
  hemiSky: C('#d4e2ff'),
  hemiGround: C('#6f604e'),
  hemi: 1.05,
  key: C('#fff1d8'),
  keyIntensity: 2.4,
  sunHeight: 1,
  moon: 0,
  stars: 0,
  lamps: 0,
  windows: 0.12,
  ridge: new THREE.Color(2.6, 2.7, 2.95),
  exposure: 0.95,
  wet: 0,
  mist: 0,
}

const DUSK: Light = {
  skyTop: C('#1d2452'),
  skyMid: C('#9b4f6e'),
  skyHorizon: C('#ffa05a'),
  fog: C('#7c5560'),
  fogDensity: 0.0042,
  hemiSky: C('#c98a7a'),
  hemiGround: C('#3a2a2a'),
  hemi: 0.8,
  key: C('#ff9a5a'),
  keyIntensity: 1.3,
  sunHeight: 0.08,
  moon: 0.35,
  stars: 0.15,
  lamps: 0.85,
  windows: 0.75,
  ridge: new THREE.Color(2.1, 1.3, 1.15),
  exposure: 1,
  wet: 0.25,
  mist: 0.35,
}

const KEYS = [NIGHT, DAWN, DAY, DUSK, NIGHT]

const out: Light = {
  ...NIGHT,
  skyTop: NIGHT.skyTop.clone(),
  skyMid: NIGHT.skyMid.clone(),
  skyHorizon: NIGHT.skyHorizon.clone(),
  fog: NIGHT.fog.clone(),
  hemiSky: NIGHT.hemiSky.clone(),
  hemiGround: NIGHT.hemiGround.clone(),
  key: NIGHT.key.clone(),
  ridge: NIGHT.ridge.clone(),
}

const COLOR_KEYS = ['skyTop', 'skyMid', 'skyHorizon', 'fog', 'hemiSky', 'hemiGround', 'key', 'ridge'] as const
const NUM_KEYS = ['fogDensity', 'hemi', 'keyIntensity', 'sunHeight', 'moon', 'stars', 'lamps', 'windows', 'exposure', 'wet', 'mist'] as const

/** Luz a la hora `tod` (0..4). Devuelve siempre el mismo objeto: no copiar si se guarda. */
export function lightAt(tod: number): Light {
  const x = Math.min(KEYS.length - 1, Math.max(0, tod))
  const i = Math.min(KEYS.length - 2, Math.floor(x))
  const t = x - i
  const s = t * t * (3 - 2 * t)
  const a = KEYS[i]
  const b = KEYS[i + 1]
  for (const k of COLOR_KEYS) out[k].copy(a[k]).lerp(b[k], s)
  for (const k of NUM_KEYS) out[k] = a[k] + (b[k] - a[k]) * s
  return out
}
