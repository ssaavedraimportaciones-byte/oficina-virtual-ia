import * as THREE from 'three'

/**
 * Texturas pintadas en un canvas al cargar la página: no hay imágenes que
 * descargar y todo queda con el mismo pulso visual. Cada función es
 * determinista (semilla fija) para que el mundo se vea igual en cada visita.
 */

export function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!, w, h)
  const tex = new THREE.CanvasTexture(c)
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

const repeat = (tex: THREE.Texture) => {
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

/** Manchas suaves de ruido: base de casi todas las superficies. */
function speckle(g: CanvasRenderingContext2D, w: number, h: number, rand: () => number, count: number, alpha: number, light = false) {
  for (let i = 0; i < count; i += 1) {
    const s = 1 + rand() * 4
    g.fillStyle = light ? `rgba(255,255,255,${rand() * alpha})` : `rgba(0,0,0,${rand() * alpha})`
    g.fillRect(rand() * w, rand() * h, s, s)
  }
}

export const glowTexture = () =>
  canvasTexture(
    128,
    128,
    (g) => {
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(0.22, 'rgba(255,255,255,0.5)')
      grad.addColorStop(0.55, 'rgba(255,255,255,0.12)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 128, 128)
    },
    false,
  )

export const discTexture = () =>
  canvasTexture(256, 256, (g) => {
    const grad = g.createRadialGradient(110, 104, 10, 128, 128, 120)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(0.85, '#e9e2d2')
    grad.addColorStop(1, '#cfc6b3')
    g.fillStyle = grad
    g.beginPath()
    g.arc(128, 128, 118, 0, Math.PI * 2)
    g.fill()
    // Mares lunares, muy tenues
    const rand = mulberry32(5)
    for (let i = 0; i < 9; i += 1) {
      g.fillStyle = `rgba(150,140,125,${0.08 + rand() * 0.1})`
      g.beginPath()
      g.arc(70 + rand() * 120, 70 + rand() * 120, 8 + rand() * 26, 0, Math.PI * 2)
      g.fill()
    }
  })

/** Estuco con losas marcadas, manchas de lluvia y desgaste. Se tiñe con el color de cada edificio. */
export const facadeTexture = () =>
  repeat(
    canvasTexture(512, 512, (g, w, h) => {
      const rand = mulberry32(31)
      g.fillStyle = '#c9c4bb'
      g.fillRect(0, 0, w, h)
      speckle(g, w, h, rand, 9000, 0.09)
      speckle(g, w, h, rand, 2500, 0.07, true)
      // Losas cada piso (la textura se repite cada ~2.1 unidades)
      for (const y of [0, 256]) {
        g.fillStyle = 'rgba(0,0,0,0.2)'
        g.fillRect(0, y, w, 3)
        g.fillStyle = 'rgba(255,255,255,0.12)'
        g.fillRect(0, y + 3, w, 2)
      }
      // Chorreado de lluvia bajo las losas
      for (let i = 0; i < 70; i += 1) {
        const x = rand() * w
        const y = rand() < 0.5 ? 5 : 261
        const len = 30 + rand() * 120
        const grad = g.createLinearGradient(0, y, 0, y + len)
        grad.addColorStop(0, `rgba(30,25,20,${0.08 + rand() * 0.12})`)
        grad.addColorStop(1, 'rgba(30,25,20,0)')
        g.fillStyle = grad
        g.fillRect(x, y, 2 + rand() * 7, len)
      }
    }),
  )

/** Asfalto: grano, parches y charcos (en el canal alfa va la rugosidad, ver groundRoughness). */
export const asphaltTexture = () =>
  repeat(
    canvasTexture(512, 512, (g, w, h) => {
      const rand = mulberry32(77)
      g.fillStyle = '#2a2c31'
      g.fillRect(0, 0, w, h)
      speckle(g, w, h, rand, 26000, 0.25)
      speckle(g, w, h, rand, 9000, 0.06, true)
      for (let i = 0; i < 14; i += 1) {
        g.fillStyle = `rgba(0,0,0,${0.08 + rand() * 0.12})`
        g.beginPath()
        g.ellipse(rand() * w, rand() * h, 20 + rand() * 70, 10 + rand() * 40, rand() * 3, 0, Math.PI * 2)
        g.fill()
      }
    }),
  )

/** Rugosidad del suelo: charcos (oscuro = liso, brilla con las luces). */
export const groundRoughness = () =>
  repeat(
    canvasTexture(
      512,
      512,
      (g, w, h) => {
        const rand = mulberry32(78)
        g.fillStyle = '#c8c8c8'
        g.fillRect(0, 0, w, h)
        speckle(g, w, h, rand, 12000, 0.2, true)
        for (let i = 0; i < 10; i += 1) {
          const x = rand() * w
          const y = rand() * h
          const r = 30 + rand() * 90
          const grad = g.createRadialGradient(x, y, 0, x, y, r)
          grad.addColorStop(0, 'rgba(10,10,10,0.95)')
          grad.addColorStop(0.7, 'rgba(10,10,10,0.6)')
          grad.addColorStop(1, 'rgba(10,10,10,0)')
          g.fillStyle = grad
          g.beginPath()
          g.ellipse(x, y, r, r * (0.4 + rand() * 0.4), rand() * 3, 0, Math.PI * 2)
          g.fill()
        }
      },
      false,
    ),
  )

/** Baldosas de vereda. */
export const sidewalkTexture = () =>
  repeat(
    canvasTexture(256, 256, (g, w, h) => {
      const rand = mulberry32(12)
      g.fillStyle = '#8c8a86'
      g.fillRect(0, 0, w, h)
      speckle(g, w, h, rand, 4000, 0.18)
      g.strokeStyle = 'rgba(40,38,36,0.6)'
      g.lineWidth = 3
      for (let i = 0; i <= 4; i += 1) {
        g.beginPath()
        g.moveTo(0, (i * h) / 4)
        g.lineTo(w, (i * h) / 4)
        g.stroke()
        g.beginPath()
        g.moveTo((i * w) / 4, 0)
        g.lineTo((i * w) / 4, h)
        g.stroke()
      }
    }),
  )

/** Ventana iluminada con cortinas: cada instancia la tiñe distinto. */
export const curtainTexture = () =>
  canvasTexture(128, 160, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, '#fff3dc')
    grad.addColorStop(1, '#f1c48a')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
    // Pliegues de cortina a los lados
    for (const side of [0, 1]) {
      for (let i = 0; i < 6; i += 1) {
        const x = side === 0 ? i * 6 : w - (i + 1) * 6
        g.fillStyle = `rgba(120,70,30,${0.12 + (i % 2) * 0.12})`
        g.fillRect(x, 0, 6, h)
      }
    }
    // Lámpara de techo
    const lamp = g.createRadialGradient(64, 26, 2, 64, 26, 46)
    lamp.addColorStop(0, 'rgba(255,255,255,0.9)')
    lamp.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = lamp
    g.fillRect(0, 0, w, 80)
  })

/** Cluster de hojas palmeadas de plátano oriental, con alfa. */
export const leafClusterTexture = () =>
  canvasTexture(256, 256, (g) => {
    const rand = mulberry32(44)
    for (let i = 0; i < 14; i += 1) {
      const x = 40 + rand() * 176
      const y = 40 + rand() * 176
      const r = 22 + rand() * 26
      const rot = rand() * Math.PI * 2
      const shade = 0.55 + rand() * 0.45
      drawPalmateLeaf(g, x, y, r, rot, `rgb(${Math.round(70 * shade)},${Math.round(110 * shade)},${Math.round(52 * shade)})`)
    }
  })

export function drawPalmateLeaf(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, fill: string, veins = 'rgba(0,0,0,0.18)') {
  g.save()
  g.translate(x, y)
  g.rotate(rot)
  g.beginPath()
  const lobes = 5
  for (let k = 0; k <= 200; k += 1) {
    const a = (k / 200) * Math.PI * 2
    // Cinco lóbulos con dientes: forma de hoja de plátano oriental
    const lobe = Math.pow(Math.abs(Math.cos((a * lobes) / 2)), 0.7)
    const teeth = 0.06 * Math.sin(a * 37)
    const back = a > Math.PI * 0.75 && a < Math.PI * 1.25 ? 0.55 : 1 // base de la hoja
    const rr = r * (0.42 + 0.58 * lobe + teeth) * back
    const px = Math.cos(a - Math.PI / 2) * rr
    const py = Math.sin(a - Math.PI / 2) * rr
    if (k === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  }
  g.closePath()
  g.fillStyle = fill
  g.fill()
  g.strokeStyle = veins
  g.lineWidth = Math.max(1, r * 0.04)
  for (let k = 0; k < lobes; k += 1) {
    const a = -Math.PI / 2 + ((k - 2) * Math.PI) / 4.2
    g.beginPath()
    g.moveTo(0, r * 0.2)
    g.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85)
    g.stroke()
  }
  g.restore()
}

/** Corteza de plátano oriental: el camuflaje crema, oliva y gris que tienen en Santiago. */
export const barkTexture = () =>
  repeat(
    canvasTexture(256, 512, (g, w, h) => {
      const rand = mulberry32(9)
      g.fillStyle = '#a8a58a'
      g.fillRect(0, 0, w, h)
      const tones = ['#d8d2b4', '#7d7a5e', '#8f8a70', '#c4bf9e', '#6b6a55']
      for (let i = 0; i < 160; i += 1) {
        g.fillStyle = tones[Math.floor(rand() * tones.length)]
        g.beginPath()
        const x = rand() * w
        const y = rand() * h
        const rx = 8 + rand() * 30
        const ry = 10 + rand() * 46
        g.ellipse(x, y, rx, ry, rand() * 0.6 - 0.3, 0, Math.PI * 2)
        g.fill()
      }
      speckle(g, w, h, rand, 3000, 0.15)
    }),
  )

/** Baranda de balcón (barrotes) con alfa. */
export const railingTexture = () =>
  canvasTexture(256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.fillStyle = '#15161b'
    g.fillRect(0, 0, w, 5)
    g.fillRect(0, h - 4, w, 4)
    for (let x = 4; x < w; x += 14) g.fillRect(x, 0, 3, h)
  })

/** Toldo a rayas. */
export const awningTexture = (a: string, b: string) =>
  canvasTexture(256, 64, (g, w, h) => {
    for (let i = 0; i < 16; i += 1) {
      g.fillStyle = i % 2 ? a : b
      g.fillRect((i * w) / 16, 0, w / 16 + 1, h)
    }
    const grad = g.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.35)')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
  })

export const closedTexture = () =>
  canvasTexture(512, 220, (g) => {
    g.fillStyle = '#efe6d2'
    g.beginPath()
    g.roundRect(8, 8, 496, 204, 22)
    g.fill()
    g.strokeStyle = '#a2271d'
    g.lineWidth = 8
    g.beginPath()
    g.roundRect(22, 22, 468, 176, 14)
    g.stroke()
    g.fillStyle = '#a2271d'
    g.font = '700 104px "Archivo Variable", Arial, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('CERRADO', 256, 118)
  })

export interface SignStyle {
  text: string
  sub?: string
  /** lightbox: caja iluminada · neon: tubo de neón · painted: letras pintadas · channel: letras corpóreas */
  kind: 'lightbox' | 'neon' | 'painted' | 'channel'
  bg: string
  fg: string
  font?: 'sans' | 'serif' | 'script'
}

/** Letrero de local. Se dibuja en dos versiones: apagado (de día) y encendido. */
export function signTexture(s: SignStyle, lit: boolean) {
  return canvasTexture(1024, 256, (g, w, h) => {
    const family =
      s.font === 'serif' ? '"Fraunces Variable", Georgia, serif' : s.font === 'script' ? '"Fraunces Variable", Georgia, serif' : '"Archivo Variable", Arial, sans-serif'
    const style = s.font === 'script' ? 'italic 600' : s.font === 'serif' ? '600' : '800'
    g.fillStyle = s.kind === 'neon' || s.kind === 'channel' ? '#0c0d10' : s.bg
    g.fillRect(0, 0, w, h)
    if (s.kind === 'lightbox' && lit) {
      const grad = g.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, 'rgba(255,255,255,0.35)')
      grad.addColorStop(0.5, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, w, h)
    }
    if (s.kind === 'painted') {
      const rand = mulberry32(s.text.length * 13)
      speckle(g, w, h, rand, 3000, 0.12)
    }
    g.strokeStyle = s.kind === 'neon' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.35)'
    g.lineWidth = 6
    g.strokeRect(6, 6, w - 12, h - 12)
    const size = s.text.length > 11 ? 92 : s.text.length > 8 ? 112 : 132
    g.font = `${style} ${size}px ${family}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const y = s.sub ? h * 0.44 : h * 0.54
    if (s.kind === 'neon') {
      g.lineWidth = 7
      g.strokeStyle = lit ? s.fg : 'rgba(120,120,130,0.55)'
      if (lit) {
        g.shadowColor = s.fg
        g.shadowBlur = 28
      }
      g.strokeText(s.text, w / 2, y)
      g.shadowBlur = 0
      if (lit) {
        g.lineWidth = 2.5
        g.strokeStyle = '#ffffff'
        g.strokeText(s.text, w / 2, y)
      }
    } else {
      if (lit && s.kind === 'channel') {
        g.shadowColor = s.fg
        g.shadowBlur = 24
      }
      g.fillStyle = lit || s.kind === 'painted' ? s.fg : shade(s.fg, 0.55)
      g.fillText(s.text, w / 2, y)
      g.shadowBlur = 0
    }
    if (s.sub) {
      g.font = `600 34px "Archivo Variable", Arial, sans-serif`
      g.fillStyle = lit ? s.fg : shade(s.fg, 0.55)
      g.globalAlpha = 0.85
      g.fillText(s.sub.toUpperCase(), w / 2, h * 0.78)
      g.globalAlpha = 1
    }
  })
}

function shade(hex: string, k: number) {
  const c = new THREE.Color(hex).multiplyScalar(k)
  return `#${c.getHexString()}`
}

/** Pantalla de la tablet del salón: el agente respondiendo. */
export const tabletTexture = () =>
  canvasTexture(256, 352, (g, w, h) => {
    g.fillStyle = '#0b0f1c'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#141b2e'
    g.fillRect(0, 0, w, 44)
    g.fillStyle = '#ffb347'
    g.font = '700 20px "Archivo Variable", Arial, sans-serif'
    g.fillText('Uñas Bella', 16, 29)
    const bubbles: [number, number, number, string][] = [
      [16, 64, 150, '#1e2740'],
      [90, 112, 150, '#f59e0b'],
      [16, 176, 120, '#1e2740'],
      [70, 220, 170, '#f59e0b'],
      [16, 290, 140, '#1e2740'],
    ]
    for (const [x, y, bw, c] of bubbles) {
      g.fillStyle = c
      g.beginPath()
      g.roundRect(x, y, bw, 36, 12)
      g.fill()
    }
  })

/** Habitación de una ventana de la historia (Ana o Caro). */
export const roomTexture = (warm: string, deep: string) =>
  canvasTexture(256, 320, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h / 2, h * 0.75)
    grad.addColorStop(0, '#fff0cf')
    grad.addColorStop(0.45, warm)
    grad.addColorStop(1, deep)
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
    // Un cuadro en la pared y una repisa: la pieza se lee como casa
    g.fillStyle = 'rgba(70,40,20,0.35)'
    g.fillRect(w * 0.6, h * 0.18, w * 0.22, h * 0.16)
    g.fillRect(w * 0.08, h * 0.62, w * 0.4, 6)
    // Cortinas
    for (const side of [0, 1]) {
      const x0 = side === 0 ? 0 : w - 34
      const cg = g.createLinearGradient(x0, 0, x0 + 34, 0)
      cg.addColorStop(0, 'rgba(110,60,30,0.7)')
      cg.addColorStop(1, 'rgba(110,60,30,0.25)')
      g.fillStyle = cg
      g.fillRect(x0, 0, 34, h)
    }
  })

/** Silueta recortada contra una ventana: alguien sentado mirando el celular, o de pie. */
export const silhouetteTexture = (pose: 'phone' | 'standing') =>
  canvasTexture(256, 320, (g) => {
    g.fillStyle = '#05070d'
    if (pose === 'phone') {
      g.beginPath()
      g.arc(120, 120, 38, 0, Math.PI * 2)
      g.fill()
      g.beginPath()
      g.moveTo(40, 320)
      g.quadraticCurveTo(46, 182, 118, 172)
      g.quadraticCurveTo(196, 176, 210, 320)
      g.fill()
      g.beginPath()
      g.moveTo(84, 250)
      g.quadraticCurveTo(140, 210, 176, 196)
      g.lineTo(186, 214)
      g.quadraticCurveTo(140, 236, 104, 270)
      g.fill()
    } else {
      g.beginPath()
      g.arc(128, 96, 36, 0, Math.PI * 2)
      g.fill()
      g.beginPath()
      g.moveTo(54, 320)
      g.quadraticCurveTo(56, 150, 128, 142)
      g.quadraticCurveTo(200, 150, 202, 320)
      g.fill()
    }
  })

/** Paredes y piso del salón. */
export const salonWallTexture = () =>
  canvasTexture(512, 256, (g, w, h) => {
    const rand = mulberry32(3)
    g.fillStyle = '#e9cfc4'
    g.fillRect(0, 0, w, h)
    speckle(g, w, h, rand, 3000, 0.05)
    // Zócalo
    g.fillStyle = '#c9a99b'
    g.fillRect(0, h - 26, w, 26)
  })

export const tileFloorTexture = () =>
  repeat(
    canvasTexture(256, 256, (g, w, h) => {
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          g.fillStyle = (x + y) % 2 ? '#e8e2d8' : '#2b2a2e'
          g.fillRect((x * w) / 8, (y * h) / 8, w / 8, h / 8)
        }
      }
    }),
  )
