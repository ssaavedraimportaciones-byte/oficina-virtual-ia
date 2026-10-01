import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import type { bus as Bus } from './bus'
import { FLIGHTS, type Place } from './data'

/**
 * El mundo de la landing: una cuadra de Santiago de noche, con la cordillera al
 * fondo. Tres ventanas cuentan la historia: Ana (que escribe desde su depa),
 * el local «Uñas Bella» (cerrado, pero responde) y Caro, la dueña (que
 * duerme). Los mensajes viajan entre ellas como luces. Todo se genera acá, sin
 * modelos ni texturas externas, y todo lo que cambia lo dicta `bus`.
 *
 * Además de dibujar, proyecta a pantalla la posición de las ventanas y de cada
 * mensaje en vuelo, para que los rótulos y las burbujas del DOM los sigan.
 */

const NIGHT = {
  skyTop: new THREE.Color('#03050c'),
  skyMid: new THREE.Color('#0a1226'),
  skyHorizon: new THREE.Color('#142141'),
  fog: new THREE.Color('#0a1122'),
  hemiSky: new THREE.Color('#4d6aa8'),
  hemiGround: new THREE.Color('#1a1410'),
}
const DAWN = {
  skyTop: new THREE.Color('#1b2347'),
  skyMid: new THREE.Color('#7b4a6c'),
  skyHorizon: new THREE.Color('#ffb36b'),
  fog: new THREE.Color('#6d4a5c'),
  hemiSky: new THREE.Color('#c58a86'),
  hemiGround: new THREE.Color('#3a2a22'),
}

const AMBER = new THREE.Color('#ffb347')
const BONE = new THREE.Color('#f1e8d6')
const FLIGHT_COLORS: Record<string, THREE.Color> = {
  contact: new THREE.Color('#e9f0ff'),
  agent: new THREE.Color('#ffb347'),
  human: new THREE.Color('#c9d3ea'),
  mail: new THREE.Color('#53bdeb'),
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeNoise(rand: () => number) {
  const table = Array.from({ length: 256 }, () => rand())
  return (x: number) => {
    const i = Math.floor(x)
    const f = x - i
    const s = f * f * (3 - 2 * f)
    return lerp(table[i & 255], table[(i + 1) & 255], s)
  }
}

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const tex = new THREE.CanvasTexture(c)
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const glowTexture = () =>
  canvasTexture(
    128,
    128,
    (g) => {
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(0.25, 'rgba(255,255,255,0.45)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 128, 128)
    },
    false,
  )

const discTexture = () =>
  canvasTexture(256, 256, (g) => {
    const grad = g.createRadialGradient(110, 104, 10, 128, 128, 120)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(0.85, '#e9e2d2')
    grad.addColorStop(1, '#cfc6b3')
    g.fillStyle = grad
    g.beginPath()
    g.arc(128, 128, 118, 0, Math.PI * 2)
    g.fill()
  })

const signTexture = () =>
  canvasTexture(1024, 256, (g) => {
    g.fillStyle = '#0d0905'
    g.fillRect(0, 0, 1024, 256)
    g.strokeStyle = 'rgba(255,179,71,0.55)'
    g.lineWidth = 4
    g.strokeRect(14, 14, 996, 228)
    g.fillStyle = '#ffd9a0'
    g.font = '600 118px Georgia, "Times New Roman", serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('UÑAS BELLA', 512, 134)
  })

const closedTexture = () =>
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
    g.font = '700 104px Georgia, "Times New Roman", serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('CERRADO', 256, 116)
  })

const roomTexture = (warm: string, deep: string) =>
  canvasTexture(256, 256, (g) => {
    const grad = g.createRadialGradient(128, 150, 10, 128, 128, 190)
    grad.addColorStop(0, '#fff0cf')
    grad.addColorStop(0.45, warm)
    grad.addColorStop(1, deep)
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
  })

/** Silueta recortada contra una ventana: alguien sentado mirando el celular, o de pie. */
const silhouetteTexture = (pose: 'phone' | 'standing') =>
  canvasTexture(256, 320, (g) => {
    g.fillStyle = '#05070d'
    if (pose === 'phone') {
      g.beginPath()
      g.arc(120, 120, 38, 0, Math.PI * 2) // cabeza, inclinada hacia el celular
      g.fill()
      g.beginPath()
      g.moveTo(40, 320)
      g.quadraticCurveTo(46, 182, 118, 172)
      g.quadraticCurveTo(196, 176, 210, 320)
      g.fill()
      g.beginPath() // brazos hacia el celular
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

export function createWorld(canvas: HTMLCanvasElement, bus: typeof Bus): () => void {
  const small = window.matchMedia('(max-width: 820px)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const lite = small || coarse

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, powerPreference: 'high-performance' })
  renderer.setClearColor(NIGHT.skyHorizon)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(NIGHT.fog.getHex(), 0.005)
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2400)
  const rand = mulberry32(7)
  const glow = glowTexture()

  // --- Cielo ----------------------------------------------------------------
  const skyUniforms = {
    uTop: { value: NIGHT.skyTop.clone() },
    uMid: { value: NIGHT.skyMid.clone() },
    uHorizon: { value: NIGHT.skyHorizon.clone() },
  }
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1800, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
          c = mix(c, uTop, smoothstep(0.18, 0.75, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  )
  scene.add(sky)

  const starCount = lite ? 700 : 1400
  const starPos = new Float32Array(starCount * 3)
  const starSeed = new Float32Array(starCount)
  for (let i = 0; i < starCount; i += 1) {
    const theta = rand() * Math.PI * 2
    const phi = Math.acos(0.08 + rand() * 0.92)
    starPos.set([1500 * Math.sin(phi) * Math.cos(theta), 1500 * Math.cos(phi), 1500 * Math.sin(phi) * Math.sin(theta)], i * 3)
    starSeed[i] = rand()
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  starGeo.setAttribute('aSeed', new THREE.BufferAttribute(starSeed, 1))
  const starUniforms = { uTime: { value: 0 }, uOpacity: { value: 1 }, uPx: { value: 1 } }
  scene.add(
    new THREE.Points(
      starGeo,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        uniforms: starUniforms,
        vertexShader: /* glsl */ `
          attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA;
          void main() {
            vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed * 1.4) + aSeed * 40.0));
            gl_PointSize = (1.2 + aSeed * 2.2) * uPx;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uOpacity; varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            gl_FragColor = vec4(0.9, 0.93, 1.0, smoothstep(0.5, 0.0, d) * vA * uOpacity);
          }`,
      }),
    ),
  )

  // --- Luna y sol -----------------------------------------------------------
  const disc = discTexture()
  const moonGroup = new THREE.Group()
  const moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc, color: new THREE.Color(1.4, 1.35, 1.25), fog: false, depthWrite: false }))
  moonDisc.scale.set(74, 74, 1)
  const moonHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow, color: '#9fb4ff', transparent: true, opacity: 0.38, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
  )
  moonHalo.scale.set(340, 340, 1)
  moonGroup.add(moonHalo, moonDisc)
  scene.add(moonGroup)

  const sunGroup = new THREE.Group()
  const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc, color: new THREE.Color('#ffc98a').multiplyScalar(2.2), fog: false, depthWrite: false }))
  sunDisc.scale.set(52, 52, 1)
  const sunHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow, color: '#ff9a4d', transparent: true, opacity: 0.7, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
  )
  sunHalo.scale.set(620, 380, 1)
  sunGroup.add(sunHalo, sunDisc)
  scene.add(sunGroup)

  // --- Cordillera -----------------------------------------------------------
  const ridges: THREE.Mesh[] = []
  const ridgeDefs = [
    { z: -330, base: 40, amp: 95, freq: 0.0085, color: '#2a3550', snow: '#aab6d6', seed: 11 },
    { z: -250, base: 28, amp: 70, freq: 0.012, color: '#1d2740', snow: '#8d9bc0', seed: 23 },
    { z: -180, base: 16, amp: 48, freq: 0.017, color: '#141c32', snow: '#6a779c', seed: 37 },
    { z: -120, base: 8, amp: 30, freq: 0.024, color: '#0d1426', snow: '#4a567a', seed: 41 },
  ]
  for (const def of ridgeDefs) {
    const noise = makeNoise(mulberry32(def.seed))
    const cols = 260
    const positions = new Float32Array((cols + 1) * 6)
    const colors = new Float32Array((cols + 1) * 6)
    const base = new THREE.Color(def.color)
    const snow = new THREE.Color(def.snow)
    const tmp = new THREE.Color()
    for (let i = 0; i <= cols; i += 1) {
      const x = (i / cols - 0.5) * 1500
      const n = noise(x * def.freq) * 0.55 + noise(x * def.freq * 2.3 + 9) * 0.3 + noise(x * def.freq * 5.1 + 21) * 0.15
      const h = def.base + Math.pow(1 - Math.abs(2 * n - 1), 1.7) * def.amp
      positions.set([x, -40, def.z, x, h, def.z], i * 6)
      tmp.copy(base).lerp(snow, smooth(def.base + def.amp * 0.4, def.base + def.amp * 0.85, h) * 0.85)
      colors.set([base.r * 0.7, base.g * 0.7, base.b * 0.7, tmp.r, tmp.g, tmp.b], i * 6)
    }
    const indices: number[] = []
    for (let i = 0; i < cols; i += 1) indices.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setIndex(indices)
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }))
    ridges.push(mesh)
    scene.add(mesh)
  }

  // --- Luces ----------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(NIGHT.hemiSky, NIGHT.hemiGround, 0.55)
  scene.add(hemi)
  const moonLight = new THREE.DirectionalLight('#8fa6e8', 0.55)
  moonLight.position.set(-40, 60, -30)
  scene.add(moonLight)

  // --- Calle ----------------------------------------------------------------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ color: '#0a0e18', roughness: 0.28, metalness: 0.15 }))
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: '#171b27', roughness: 0.7 })
  for (const z of [-4.1, 6.4]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(220, 0.18, 4.2), sidewalkMat)
    s.position.set(0, 0.09, z)
    scene.add(s)
  }

  // --- Edificios ------------------------------------------------------------
  const FRONT_Z = -9
  const FACE_Z = FRONT_Z + 3.5 + 0.03
  const brand = mulberry32(99)
  const buildingColors = ['#10162a', '#121a2e', '#0e1424', '#151b2f', '#0f1526']
  const windowSlots: { x: number; y: number; z: number }[] = []
  const reserved: { x: number; y: number }[] = []

  const addBuilding = (x: number, width: number, height: number, z: number, depth: number, lit: number, color?: string) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color: color ?? buildingColors[Math.floor(brand() * buildingColors.length)], roughness: 0.9 }),
    )
    m.position.set(x, height / 2, z)
    scene.add(m)
    const cols = Math.max(1, Math.floor(width / 1.7))
    const rows = Math.max(1, Math.floor((height - 3.2) / 2.1))
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const wx = x - width / 2 + (c + 0.5) * (width / cols)
        const wy = 3.4 + r * 2.1
        if (reserved.some((p) => Math.abs(p.x - wx) < 1.6 && Math.abs(p.y - wy) < 1.6)) continue
        if (brand() > lit) continue
        windowSlots.push({ x: wx, y: wy, z: z + depth / 2 + 0.02 })
      }
    }
  }

  // Las tres ventanas de la historia
  const ANA = new THREE.Vector3(-7.9, 6.2, FACE_Z)
  const OWNER = new THREE.Vector3(8.3, 8.6, FACE_Z)
  reserved.push({ x: ANA.x, y: ANA.y }, { x: OWNER.x, y: OWNER.y })

  const shopW = 7
  addBuilding(-7.25, 7.3, 10, FRONT_Z, 7, 0.08, '#121a30') // edificio de Ana
  addBuilding(7.45, 7.7, 12.5, FRONT_Z, 7, 0.08, '#111830') // edificio de Caro
  let cursor = -10.9
  while (cursor > -140) {
    const w = 4 + brand() * 5
    addBuilding(cursor - w / 2 - 0.1, w, 6 + brand() * 12, FRONT_Z, 7, 0.3)
    cursor -= w + 0.2
  }
  cursor = 11.3
  while (cursor < 140) {
    const w = 4 + brand() * 5
    addBuilding(cursor + w / 2 + 0.1, w, 6 + brand() * 12, FRONT_Z, 7, 0.3)
    cursor += w + 0.2
  }
  for (let x = -150; x < 150; x += 7 + brand() * 6) {
    addBuilding(x, 6 + brand() * 6, 10 + brand() * 26, -34 - brand() * 22, 10, 0.18)
  }

  const windows = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 1.2), new THREE.MeshBasicMaterial({ color: 0xffffff }), windowSlots.length)
  const dummy = new THREE.Object3D()
  const winColor = new THREE.Color()
  windowSlots.forEach((slot, i) => {
    dummy.position.set(slot.x, slot.y, slot.z)
    dummy.updateMatrix()
    windows.setMatrixAt(i, dummy.matrix)
    winColor.copy(brand() > 0.15 ? AMBER : BONE).multiplyScalar(0.12 + brand() * 0.32)
    windows.setColorAt(i, winColor)
  })
  windows.instanceMatrix.needsUpdate = true
  if (windows.instanceColor) windows.instanceColor.needsUpdate = true
  scene.add(windows)

  /** Una ventana con habitación iluminada, silueta y celular. */
  const storyWindow = (at: THREE.Vector3, pose: 'phone' | 'standing', warm: string, deep: string) => {
    const group = new THREE.Group()
    group.position.copy(at)
    const room = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9), new THREE.MeshBasicMaterial({ map: roomTexture(warm, deep), color: new THREE.Color(1.2, 1.1, 1) }))
    const person = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.38), new THREE.MeshBasicMaterial({ map: silhouetteTexture(pose), transparent: true }))
    person.position.set(pose === 'phone' ? -0.1 : 0.15, -0.26, 0.01)
    const frameMat = new THREE.MeshStandardMaterial({ color: '#0a0c14', roughness: 0.6 })
    const bars: [number, number, number, number][] = [
      [1.7, 0.1, 0, 1.0],
      [1.7, 0.14, 0, -1.0],
      [0.1, 2.1, -0.8, 0],
      [0.1, 2.1, 0.8, 0],
      [0.06, 1.9, 0, 0],
    ]
    for (const [w, h, x, y] of bars) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), frameMat)
      b.position.set(x, y, 0.04)
      group.add(b)
    }
    const phone = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#b9dcff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
    phone.position.set(pose === 'phone' ? 0.24 : -0.45, pose === 'phone' ? -0.25 : -0.62, 0.05)
    phone.scale.set(0.9, 0.9, 1)
    const spill = new THREE.PointLight(warm, 0, 9, 1.8)
    spill.position.set(0, 0, 1.2)
    group.add(room, person, phone, spill)
    scene.add(group)
    return { group, room, person, phone, spill }
  }
  const ana = storyWindow(ANA, 'phone', '#ffcf8a', '#b8662c')
  const owner = storyWindow(OWNER, 'standing', '#ffd59a', '#c07434')

  // El local
  const shop = new THREE.Group()
  shop.position.set(0, 0, FRONT_Z)
  scene.add(shop)
  const shopBody = new THREE.Mesh(new THREE.BoxGeometry(shopW, 6.4, 7), new THREE.MeshStandardMaterial({ color: '#171b2e', roughness: 0.85 }))
  shopBody.position.set(0, 3.2, 0)
  shop.add(shopBody)
  const shopLight = new THREE.PointLight('#ffb461', 8, 22, 1.7)
  shopLight.position.set(0, 2.4, 3.4)
  shop.add(shopLight)
  const paneMat = new THREE.MeshBasicMaterial({ map: roomTexture('#ffc977', '#c9762b'), color: new THREE.Color(0.5, 0.45, 0.37) })
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.7), paneMat)
  pane.position.set(0, 2.15, 3.52)
  shop.add(pane)
  const frameMat = new THREE.MeshStandardMaterial({ color: '#0a0805', roughness: 0.6 })
  const frameParts: [number, number, number, number][] = [
    [5.4, 0.14, 0, 3.55],
    [5.4, 0.14, 0, 0.8],
    [0.14, 2.9, -2.65, 2.15],
    [0.14, 2.9, 2.65, 2.15],
    [0.1, 2.7, -0.9, 2.15],
    [0.1, 2.7, 0.9, 2.15],
  ]
  for (const [w, h, x, y] of frameParts) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.18), frameMat)
    f.position.set(x, y, 3.56)
    shop.add(f)
  }
  // Repisas y frascos de esmalte. Los dos del centro de abajo son los que se venden.
  const bottleColors = ['#e04b3a', '#ffd9a0', '#7a2f5a', '#f2a65a', '#d9d2c3', '#b83b52', '#ffb347']
  const soldBottles: { meshes: THREE.Mesh[]; y: number }[] = []
  for (let i = 0; i < 14; i += 1) {
    const bx = -2.1 + (i % 7) * 0.7
    const by = i < 7 ? 1.9 : 2.75
    const sold = i === 3 || i === 4
    const bodyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(sold ? '#e04b3a' : bottleColors[(i * 3) % bottleColors.length]).multiplyScalar(1.2), transparent: sold })
    const capMat = new THREE.MeshBasicMaterial({ color: '#0a0805', transparent: sold })
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.34, 10), bodyMat)
    bottle.position.set(bx, by, 3.46)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.1), capMat)
    cap.position.set(bx, by + 0.24, 3.46)
    shop.add(bottle, cap)
    if (sold) soldBottles.push({ meshes: [bottle, cap], y: by })
  }
  for (const y of [1.72, 2.57]) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(5, 0.06, 0.4), new THREE.MeshBasicMaterial({ color: '#3a2615' }))
    shelf.position.set(0, y, 3.46)
    shop.add(shelf)
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15), new THREE.MeshBasicMaterial({ map: signTexture(), color: new THREE.Color(1.6, 1.45, 1.2) }))
  sign.position.set(0, 4.75, 3.55)
  shop.add(sign)
  // Letrero de «CERRADO» colgando detrás del vidrio
  const closed = new THREE.Group()
  const closedPlate = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.54), new THREE.MeshBasicMaterial({ map: closedTexture(), color: new THREE.Color(1.05, 1.02, 0.98) }))
  closed.add(closedPlate)
  for (const x of [-0.42, 0.42]) {
    const cord = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.5, 0.01), frameMat)
    cord.position.set(x * 0.7, 0.42, 0)
    cord.rotation.z = x > 0 ? -0.5 : 0.5
    closed.add(cord)
  }
  closed.position.set(0, 3.05, 3.6)
  shop.add(closed)
  const awning = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.12, 1.3), new THREE.MeshStandardMaterial({ color: '#2b1a12', roughness: 0.8 }))
  awning.position.set(0, 3.95, 4.15)
  awning.rotation.x = 0.18
  shop.add(awning)

  // Postes de alumbrado
  const poleMat = new THREE.MeshStandardMaterial({ color: '#0b0d14', roughness: 0.6, metalness: 0.4 })
  const lampSprites: THREE.Sprite[] = []
  const lampLights: THREE.PointLight[] = []
  const lampBulbMat = new THREE.MeshBasicMaterial({ color: AMBER.clone().multiplyScalar(3) })
  ;[-27, -14.5, 14.5, 27].forEach((x, i) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.4, 8), poleMat)
    pole.position.set(x, 2.7, 4.6)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.07), poleMat)
    arm.position.set(x, 5.35, 4.1)
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), lampBulbMat)
    bulb.position.set(x, 5.25, 3.6)
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffb25a', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }))
    halo.scale.set(3, 3, 1)
    halo.position.copy(bulb.position)
    scene.add(pole, arm, bulb, halo)
    lampSprites.push(halo)
    if (!lite && (i === 1 || i === 2)) {
      const light = new THREE.PointLight('#ffb25a', 14, 22, 1.8)
      light.position.set(x, 5, 3.4)
      scene.add(light)
      lampLights.push(light)
    }
  })

  // --- Lluvia ---------------------------------------------------------------
  const dropCount = lite ? 1400 : 3200
  const dropPos = new Float32Array(dropCount * 6)
  const dropTip = new Float32Array(dropCount * 2)
  const dropRand = new Float32Array(dropCount * 2)
  for (let i = 0; i < dropCount; i += 1) {
    const x = (rand() - 0.5) * 70
    const y = rand() * 26
    const z = -12 + rand() * 46
    const r = rand()
    dropPos.set([x, y, z, x, y, z], i * 6)
    dropTip.set([0, 1], i * 2)
    dropRand.set([r, r], i * 2)
  }
  const rainGeo = new THREE.BufferGeometry()
  rainGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3))
  rainGeo.setAttribute('aTip', new THREE.BufferAttribute(dropTip, 1))
  rainGeo.setAttribute('aRand', new THREE.BufferAttribute(dropRand, 1))
  const rainUniforms = { uTime: { value: 0 }, uIntensity: { value: 0 }, uH: { value: 26 } }
  const rain = new THREE.LineSegments(
    rainGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: rainUniforms,
      vertexShader: /* glsl */ `
        attribute float aTip; attribute float aRand;
        uniform float uTime; uniform float uIntensity; uniform float uH;
        varying float vA;
        void main() {
          float y = mod(position.y - uTime * (16.0 + aRand * 8.0), uH);
          vec3 p = vec3(position.x + y * 0.07, y + aTip * 0.9, position.z);
          vA = step(aRand, uIntensity) * (0.12 + 0.28 * aRand);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() { gl_FragColor = vec4(0.72, 0.8, 1.0, vA); }`,
    }),
  )
  rain.frustumCulled = false
  scene.add(rain)

  // --- Mensajes en vuelo ----------------------------------------------------
  const PLACES: Record<Place, THREE.Vector3> = {
    ana: ANA.clone().add(new THREE.Vector3(0.2, -0.2, 0.25)),
    shop: new THREE.Vector3(0, 2.3, FACE_Z + 0.3),
    owner: OWNER.clone().add(new THREE.Vector3(0, -0.2, 0.25)),
  }
  const TRAIL = 9
  const flights = FLIGHTS.map((f) => {
    const a = PLACES[f.from]
    const b = PLACES[f.to]
    const mid = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, 3.2, 3.5))
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
    const color = FLIGHT_COLORS[f.kind]
    const sprites = Array.from({ length: TRAIL }, (_, k) => {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glow, color: color.clone().multiplyScalar(k === 0 ? 2.2 : 1.4), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      )
      const size = k === 0 ? 1.5 : 0.9 * (1 - k / TRAIL)
      s.scale.set(size, size, 1)
      s.visible = false
      scene.add(s)
      return s
    })
    return { ...f, curve, sprites }
  })

  // --- Elementos del DOM que siguen a la escena ------------------------------
  const anchorEls = Array.from(document.querySelectorAll<HTMLElement>('[data-anchor]'))
  const flightEls = new Map(Array.from(document.querySelectorAll<HTMLElement>('[data-flight]')).map((el) => [el.dataset.flight!, el]))
  const LABEL_POINTS: Record<string, THREE.Vector3> = {
    ana: ANA.clone().add(new THREE.Vector3(0, -1.15, 0)),
    shop: new THREE.Vector3(0, 5.5, FACE_Z),
    owner: OWNER.clone().add(new THREE.Vector3(0, -1.15, 0)),
    shelf: new THREE.Vector3(-0.0, 1.62, FACE_Z),
  }
  const projTmp = new THREE.Vector3()
  const project = (p: THREE.Vector3) => {
    projTmp.copy(p).project(camera)
    return { x: (projTmp.x * 0.5 + 0.5) * width, y: (-projTmp.y * 0.5 + 0.5) * height, inFront: projTmp.z < 1, nx: projTmp.x, ny: projTmp.y }
  }

  // --- Cámara: un plano por capítulo ---------------------------------------
  // 0 portada (cielo) · 1 la cuadra · 2 vitrina · 3 estante · 4 lluvia, las tres ventanas · 5 amanecer
  const SHOTS = {
    wide: {
      pos: [
        [0, 2.4, 40],
        [0, 3.6, 18.5],
        [-2.4, 2.3, 6.2],
        [1.2, 2.15, 1.6],
        [-3.2, 1.7, 16],
        [0, 21, 40],
      ],
      tgt: [
        [-6, 40, -200],
        [0, 5.2, -9],
        [0.3, 2.7, -9],
        [0, 2.25, -6],
        [2.2, 6.4, -9],
        [8, 25, -220],
      ],
    },
    tall: {
      pos: [
        [0, 2.4, 44],
        [-2.8, 5, 25],
        [-0.8, 2.6, 9.5],
        [0.4, 2.3, 4.4],
        [3.2, 3.4, 28],
        [0, 22, 44],
      ],
      tgt: [
        [-6, 40, -200],
        [-2.8, 5.6, -9],
        [0, 2.7, -9],
        [0, 2.25, -6],
        [3.2, 6.6, -9],
        [6, 25, -220],
      ],
    },
  }
  const curvesFor = (set: typeof SHOTS.wide) => ({
    pos: new THREE.CatmullRomCurve3(set.pos.map((p) => new THREE.Vector3(...(p as [number, number, number]))), false, 'centripetal'),
    tgt: new THREE.CatmullRomCurve3(set.tgt.map((p) => new THREE.Vector3(...(p as [number, number, number]))), false, 'centripetal'),
  })
  const WIDE = curvesFor(SHOTS.wide)
  const TALL = curvesFor(SHOTS.tall)
  let rig = WIDE
  const posTmp = new THREE.Vector3()
  const tgtTmp = new THREE.Vector3()

  // --- Post-proceso ---------------------------------------------------------
  let composer: EffectComposer | null = null
  let bloom: UnrealBloomPass | null = null
  if (!lite) {
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.7, 0.88)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
  }

  let width = 1
  let height = 1
  let quality = 2
  const resize = () => {
    width = canvas.clientWidth || window.innerWidth
    height = canvas.clientHeight || window.innerHeight
    const cap = quality >= 2 ? (lite ? 1.25 : 1.75) : quality === 1 ? 1 : 0.7
    const dpr = Math.min(window.devicePixelRatio || 1, cap)
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height, false)
    composer?.setPixelRatio(dpr)
    composer?.setSize(width, height)
    camera.aspect = width / height
    rig = camera.aspect < 0.9 ? TALL : WIDE
    camera.fov = camera.aspect < 0.9 ? 50 : 38
    camera.updateProjectionMatrix()
    starUniforms.uPx.value = dpr
  }
  resize()
  window.addEventListener('resize', resize)

  const pointer = { x: 0, y: 0, sx: 0, sy: 0 }
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth - 0.5) * 2
    pointer.y = (e.clientY / window.innerHeight - 0.5) * 2
  }
  if (!coarse) window.addEventListener('pointermove', onPointer, { passive: true })

  // --- Bucle ----------------------------------------------------------------
  const target = () => (bus.hero < 1 ? bus.hero : 1 + bus.cam)
  let us = target()
  let slow = 16
  let frames = 0
  let raf = 0
  let last = performance.now()
  let running = false
  let visible = true
  const clock0 = last

  const frame = (now: number) => {
    raf = 0
    if (!running) return
    const rawDt = (now - last) / 1000
    const dt = Math.min(0.05, rawDt)
    last = now
    const t = (now - clock0) / 1000

    // Para grabar el recorrido cuadro a cuadro en desarrollo: la cámara salta al plano exacto.
    const snap = process.env.NODE_ENV !== 'production' && (window as unknown as { __zvSnap?: boolean }).__zvSnap
    us = snap ? target() : us + (target() - us) * (1 - Math.exp(-dt * 3.2))
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 2.2))
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 2.2))

    const k = clamp01(us / 5)
    rig.pos.getPoint(k, posTmp)
    rig.tgt.getPoint(k, tgtTmp)
    posTmp.x += Math.sin(t * 0.21) * 0.08 + pointer.sx * 0.18
    posTmp.y += Math.sin(t * 0.17) * 0.04 - pointer.sy * 0.08
    camera.position.copy(posTmp)
    camera.lookAt(tgtTmp)
    camera.updateMatrixWorld()

    // Noche → amanecer
    const dawn = clamp01(bus.dawn)
    skyUniforms.uTop.value.copy(NIGHT.skyTop).lerp(DAWN.skyTop, dawn)
    skyUniforms.uMid.value.copy(NIGHT.skyMid).lerp(DAWN.skyMid, dawn)
    skyUniforms.uHorizon.value.copy(NIGHT.skyHorizon).lerp(DAWN.skyHorizon, dawn)
    const fog = scene.fog as THREE.FogExp2
    fog.color.copy(NIGHT.fog).lerp(DAWN.fog, dawn)
    fog.density = lerp(0.005, 0.0034, dawn) + bus.rain * 0.0035
    renderer.setClearColor(fog.color)
    hemi.color.copy(NIGHT.hemiSky).lerp(DAWN.hemiSky, dawn)
    hemi.groundColor.copy(NIGHT.hemiGround).lerp(DAWN.hemiGround, dawn)
    hemi.intensity = lerp(0.55, 0.9, dawn)
    moonLight.intensity = lerp(0.55, 0.15, dawn)
    starUniforms.uTime.value = t
    starUniforms.uOpacity.value = 1 - smooth(0, 0.6, dawn)
    rainUniforms.uTime.value = t
    rainUniforms.uIntensity.value = clamp01(bus.rain)
    rain.visible = bus.rain > 0.01

    const moonT = smooth(0, 5, us)
    moonGroup.position.set(lerp(-110, -190, moonT), lerp(190, 60, moonT) - dawn * 40, -420)
    moonGroup.visible = dawn < 0.98
    moonHalo.material.opacity = 0.38 * (1 - dawn)
    sunGroup.position.set(60, lerp(-30, 132, dawn), -430)
    sunGroup.visible = dawn > 0.01
    sunHalo.material.opacity = 0.75 * dawn
    const alp = new THREE.Color(1, 1, 1).lerp(new THREE.Color(1.9, 1.2, 1.0), dawn)
    ridges.forEach((r, i) => (r.material as THREE.MeshBasicMaterial).color.copy(alp).multiplyScalar(1 - i * 0.04))

    const lampLevel = 1 - dawn * 0.75
    lampSprites.forEach((s, i) => (s.material.opacity = 0.55 * lampLevel * (0.94 + 0.06 * Math.sin(t * 2.1 + i))))
    lampLights.forEach((l) => (l.intensity = 14 * lampLevel))
    lampBulbMat.color.copy(AMBER).multiplyScalar(3 * lampLevel + 0.3)

    // El local: casi a oscuras cuando está cerrado; se enciende cuando el agente responde.
    const shopLevel = clamp01(bus.shop)
    const breath = shopLevel > 0.6 ? 0.06 * Math.sin(t * 2.4) : 0
    paneMat.color.setScalar(0.3 + shopLevel * 0.62 + breath).multiply(new THREE.Color(1, 0.92, 0.78))
    shopLight.intensity = 5 + shopLevel * 14

    // Ventanas de Ana y de Caro
    const anaRoom = ana.room.material as THREE.MeshBasicMaterial
    anaRoom.color.setScalar(1.05)
    ana.spill.intensity = 3
    ana.phone.material.opacity = clamp01(bus.anaPhone) * (0.85 + 0.15 * Math.sin(t * 3))
    const ownerLevel = clamp01(bus.owner)
    ;(owner.room.material as THREE.MeshBasicMaterial).color.setScalar(0.06 + ownerLevel * 1.05)
    ;(owner.person.material as THREE.MeshBasicMaterial).opacity = 0.25 + ownerLevel * 0.75
    owner.spill.intensity = ownerLevel * 3
    const ping = clamp01(bus.ownerPhone)
    owner.phone.material.opacity = ping * (0.75 + 0.25 * Math.sin(t * 7))
    owner.phone.scale.setScalar(0.9 + ping * 0.6)

    // Frascos vendidos: suben y se desvanecen
    soldBottles.forEach((b, i) => {
      const s = clamp01(bus.sold - i)
      b.meshes.forEach((m, j) => {
        ;(m.material as THREE.MeshBasicMaterial).opacity = 1 - s
        m.position.y = b.y + (j === 1 ? 0.24 : 0) + s * 0.5
        m.visible = s < 0.99
      })
    })

    // Mensajes en vuelo
    for (const f of flights) {
      const p = bus.fl[f.id] ?? 0
      const flying = p > 0.001 && p < 0.999
      f.sprites.forEach((s, k) => {
        const tk = clamp01(p - k * 0.03)
        s.visible = flying && tk > 0
        if (!s.visible) return
        f.curve.getPoint(tk, s.position)
        s.material.opacity = (k === 0 ? 1 : 0.7 * (1 - k / TRAIL)) * smooth(0, 0.08, p) * (1 - smooth(0.94, 1, p))
      })
      const el = flightEls.get(f.id)
      if (el) {
        const pt = project(f.curve.getPoint(clamp01(p)))
        el.style.setProperty('--ax', `${pt.x.toFixed(1)}px`)
        el.style.setProperty('--ay', `${pt.y.toFixed(1)}px`)
      }
    }
    for (const el of anchorEls) {
      const pt = project(LABEL_POINTS[el.dataset.anchor!])
      const off = !pt.inFront || Math.abs(pt.nx) > 0.96 || Math.abs(pt.ny) > 0.9
      el.style.setProperty('--ax', `${pt.x.toFixed(1)}px`)
      el.style.setProperty('--ay', `${pt.y.toFixed(1)}px`)
      const state = off ? 'true' : 'false'
      if (el.dataset.off !== state) el.dataset.off = state
    }

    if (bloom) bloom.strength = lerp(0.4, 0.3, dawn)

    if (rawDt < 0.2) {
      slow = slow * 0.95 + rawDt * 1000 * 0.05
      frames += 1
      if (frames > 90 && slow > 38 && quality > 0) {
        quality -= 1
        frames = 0
        slow = 16
        resize()
      }
    }
    if (composer && quality >= 2) composer.render()
    else renderer.render(scene, camera)
    raf = requestAnimationFrame(frame)
  }

  const start = () => {
    if (running || !visible || document.hidden) return
    running = true
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
  const stop = () => {
    running = false
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  const zone = document.querySelector('[data-zone]')
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting)
      if (visible) start()
      else stop()
    },
    { threshold: 0 },
  )
  if (zone) io.observe(zone)
  const onVisibility = () => (document.hidden ? stop() : start())
  document.addEventListener('visibilitychange', onVisibility)
  const onLost = (e: Event) => {
    e.preventDefault()
    stop()
  }
  canvas.addEventListener('webglcontextlost', onLost)

  start()
  canvas.dataset.ready = 'true'
  document.documentElement.dataset.world = 'on'

  return () => {
    stop()
    io.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('resize', resize)
    window.removeEventListener('pointermove', onPointer)
    canvas.removeEventListener('webglcontextlost', onLost)
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      mesh.geometry?.dispose?.()
      const mat = mesh.material as (THREE.Material & { map?: THREE.Texture | null }) | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else {
        mat?.map?.dispose()
        mat?.dispose?.()
      }
    })
    composer?.dispose()
    renderer.dispose()
    delete canvas.dataset.ready
    delete document.documentElement.dataset.world
  }
}
