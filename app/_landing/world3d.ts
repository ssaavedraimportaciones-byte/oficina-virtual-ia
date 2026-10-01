import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import type { bus as Bus } from './bus'

/**
 * El mundo de la landing: una calle comercial chilena de noche, con la
 * cordillera al fondo. Todo se genera acá, sin modelos ni texturas externas.
 * La cámara sigue `bus.u` (0 = portada, 1 a 5 = los cinco capítulos) y la
 * noche se va transformando en amanecer a medida que avanza.
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
  fog: new THREE.Color('#7a5262'),
  hemiSky: new THREE.Color('#c58a86'),
  hemiGround: new THREE.Color('#3a2a22'),
}

const AMBER = new THREE.Color('#ffb347')
const BONE = new THREE.Color('#f1e8d6')
const TICK_BLUE = new THREE.Color('#53bdeb')

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

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

function discTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(110, 104, 10, 128, 128, 120)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(0.85, '#e9e2d2')
  grad.addColorStop(1, '#cfc6b3')
  g.fillStyle = grad
  g.beginPath()
  g.arc(128, 128, 118, 0, Math.PI * 2)
  g.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function signTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const g = c.getContext('2d')!
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
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function windowGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(128, 150, 10, 128, 128, 190)
  grad.addColorStop(0, '#fff0cf')
  grad.addColorStop(0.45, '#ffc977')
  grad.addColorStop(1, '#c9762b')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function createWorld(canvas: HTMLCanvasElement, bus: typeof Bus): () => void {
  const small = window.matchMedia('(max-width: 820px)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const lite = small || coarse

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, powerPreference: 'high-performance' })
  renderer.setClearColor(NIGHT.skyHorizon)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(NIGHT.fog.getHex(), 0.0048)

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2400)

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
  sky.renderOrder = -10
  scene.add(sky)

  // Estrellas
  const rand = mulberry32(7)
  const starCount = lite ? 700 : 1400
  const starPos = new Float32Array(starCount * 3)
  const starSeed = new Float32Array(starCount)
  for (let i = 0; i < starCount; i += 1) {
    const theta = rand() * Math.PI * 2
    const phi = Math.acos(0.08 + rand() * 0.92)
    const r = 1500
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    starPos[i * 3 + 1] = r * Math.cos(phi)
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    starSeed[i] = rand()
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  starGeo.setAttribute('aSeed', new THREE.BufferAttribute(starSeed, 1))
  const starUniforms = { uTime: { value: 0 }, uOpacity: { value: 1 }, uPx: { value: 1 } }
  const stars = new THREE.Points(
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
          float a = smoothstep(0.5, 0.0, d) * vA * uOpacity;
          gl_FragColor = vec4(0.9, 0.93, 1.0, a);
        }`,
    }),
  )
  scene.add(stars)

  // --- Luna y sol -----------------------------------------------------------
  const glow = glowTexture()
  const moonGroup = new THREE.Group()
  const disc = discTexture()
  const moonDisc = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: disc, color: new THREE.Color(1.4, 1.35, 1.25), fog: false, depthWrite: false }),
  )
  moonDisc.scale.set(74, 74, 1)
  const moonHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow, color: '#9fb4ff', transparent: true, opacity: 0.38, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
  )
  moonHalo.scale.set(340, 340, 1)
  moonGroup.add(moonHalo, moonDisc)
  scene.add(moonGroup)

  const sunGroup = new THREE.Group()
  const sunDisc = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: disc, color: new THREE.Color('#ffc98a').multiplyScalar(2.2), fog: false, depthWrite: false }),
  )
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
    const width = 1500
    const positions = new Float32Array((cols + 1) * 2 * 3)
    const colors = new Float32Array((cols + 1) * 2 * 3)
    const base = new THREE.Color(def.color)
    const snow = new THREE.Color(def.snow)
    const tmp = new THREE.Color()
    for (let i = 0; i <= cols; i += 1) {
      const x = (i / cols - 0.5) * width
      const n = noise(x * def.freq) * 0.55 + noise(x * def.freq * 2.3 + 9) * 0.3 + noise(x * def.freq * 5.1 + 21) * 0.15
      const ridged = 1 - Math.abs(2 * n - 1)
      const h = def.base + Math.pow(ridged, 1.7) * def.amp
      positions.set([x, -40, def.z], i * 6)
      positions.set([x, h, def.z], i * 6 + 3)
      colors.set([base.r * 0.7, base.g * 0.7, base.b * 0.7], i * 6)
      const snowAmount = smooth(def.base + def.amp * 0.4, def.base + def.amp * 0.85, h)
      tmp.copy(base).lerp(snow, snowAmount * 0.85)
      colors.set([tmp.r, tmp.g, tmp.b], i * 6 + 3)
    }
    const indices: number[] = []
    for (let i = 0; i < cols; i += 1) {
      const a = i * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
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
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshStandardMaterial({ color: '#0a0e18', roughness: 0.28, metalness: 0.15 }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(220, 0.18, 4.2), new THREE.MeshStandardMaterial({ color: '#171b27', roughness: 0.7 }))
  sidewalk.position.set(0, 0.09, -4.1)
  scene.add(sidewalk)
  const sidewalkNear = sidewalk.clone()
  sidewalkNear.position.set(0, 0.09, 6.4)
  scene.add(sidewalkNear)

  // Edificios de la vereda de enfrente al local
  const brand = mulberry32(99)
  const buildingColors = ['#10162a', '#121a2e', '#0e1424', '#151b2f', '#0f1526']
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true })
  const windowSlots: { x: number; y: number; z: number; w: number; h: number }[] = []

  const addBuilding = (x: number, width: number, height: number, z: number, depth: number, lit: number) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color: buildingColors[Math.floor(brand() * buildingColors.length)], roughness: 0.9 }),
    )
    m.position.set(x, height / 2, z)
    scene.add(m)
    const cols = Math.max(1, Math.floor(width / 1.7))
    const rows = Math.max(1, Math.floor((height - 3.2) / 2.1))
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (brand() > lit) continue
        windowSlots.push({
          x: x - width / 2 + (c + 0.5) * (width / cols),
          y: 3.4 + r * 2.1,
          z: z + depth / 2 + 0.02,
          w: 0.9,
          h: 1.2,
        })
      }
    }
  }

  const shopX = 0
  const shopW = 7
  // Fila de enfrente, a ambos lados del local
  let cursor = shopX - shopW / 2
  while (cursor > -140) {
    const w = 4 + brand() * 5
    const h = 6 + brand() * 12
    addBuilding(cursor - w / 2 - 0.1, w, h, -9, 7, 0.34)
    cursor -= w + 0.2
  }
  cursor = shopX + shopW / 2
  while (cursor < 140) {
    const w = 4 + brand() * 5
    const h = 6 + brand() * 12
    addBuilding(cursor + w / 2 + 0.1, w, h, -9, 7, 0.34)
    cursor += w + 0.2
  }
  // Segunda fila, más lejos
  for (let x = -150; x < 150; x += 7 + brand() * 6) {
    const h = 10 + brand() * 26
    addBuilding(x, 6 + brand() * 6, h, -34 - brand() * 22, 10, 0.2)
  }

  // El local
  const shop = new THREE.Group()
  shop.position.set(shopX, 0, -9)
  scene.add(shop)
  const shopBody = new THREE.Mesh(new THREE.BoxGeometry(shopW, 6.4, 7), new THREE.MeshStandardMaterial({ color: '#171b2e', roughness: 0.85 }))
  shopBody.position.set(0, 3.2, 0)
  shop.add(shopBody)

  const shopLight = new THREE.PointLight('#ffb461', 26, 22, 1.7)
  shopLight.position.set(0, 2.4, 3.4)
  shop.add(shopLight)

  const windowTex = windowGlowTexture()
  const windowPane = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 2.7),
    new THREE.MeshBasicMaterial({ map: windowTex, color: new THREE.Color(1.5, 1.35, 1.1), toneMapped: true }),
  )
  windowPane.position.set(0, 2.15, 3.52)
  shop.add(windowPane)

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

  // Repisa con frascos de esmalte
  const bottleColors = ['#e04b3a', '#ffd9a0', '#7a2f5a', '#f2a65a', '#d9d2c3', '#b83b52', '#ffb347']
  for (let i = 0; i < 14; i += 1) {
    const bx = -2.1 + (i % 7) * 0.7
    const by = i < 7 ? 1.9 : 2.75
    const color = new THREE.Color(bottleColors[(i * 3) % bottleColors.length]).multiplyScalar(1.2)
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.34, 10), new THREE.MeshBasicMaterial({ color }))
    bottle.position.set(bx, by, 3.46)
    shop.add(bottle)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.1), new THREE.MeshBasicMaterial({ color: '#0a0805' }))
    cap.position.set(bx, by + 0.24, 3.46)
    shop.add(cap)
  }
  for (const y of [1.72, 2.57]) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(5, 0.06, 0.4), new THREE.MeshBasicMaterial({ color: '#3a2615' }))
    shelf.position.set(0, y, 3.46)
    shop.add(shelf)
  }

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 1.15),
    new THREE.MeshBasicMaterial({ map: signTexture(), color: new THREE.Color(1.6, 1.45, 1.2), toneMapped: true }),
  )
  sign.position.set(0, 4.75, 3.55)
  shop.add(sign)

  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(5.8, 0.12, 1.3),
    new THREE.MeshStandardMaterial({ color: '#2b1a12', roughness: 0.8 }),
  )
  awning.position.set(0, 3.95, 4.15)
  awning.rotation.x = 0.18
  shop.add(awning)

  // Ventanas encendidas (instanciadas)
  const windows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), windowMat, windowSlots.length)
  const dummy = new THREE.Object3D()
  const winColor = new THREE.Color()
  windowSlots.forEach((slot, i) => {
    dummy.position.set(slot.x, slot.y, slot.z)
    dummy.scale.set(slot.w, slot.h, 1)
    dummy.updateMatrix()
    windows.setMatrixAt(i, dummy.matrix)
    const warm = brand() > 0.25
    winColor.copy(warm ? AMBER : BONE).multiplyScalar(0.28 + brand() * 0.62)
    windows.setColorAt(i, winColor)
  })
  windows.instanceMatrix.needsUpdate = true
  if (windows.instanceColor) windows.instanceColor.needsUpdate = true
  scene.add(windows)

  // Postes de alumbrado
  const poleMat = new THREE.MeshStandardMaterial({ color: '#0b0d14', roughness: 0.6, metalness: 0.4 })
  const lampSprites: THREE.Sprite[] = []
  const lampLights: THREE.PointLight[] = []
  const lampBulbMat = new THREE.MeshBasicMaterial({ color: AMBER.clone().multiplyScalar(3) })
  const lampXs = [-26, -15, -6.5, 7, 16, 28]
  lampXs.forEach((x, i) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.4, 8), poleMat)
    pole.position.set(x, 2.7, 4.6)
    scene.add(pole)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.07), poleMat)
    arm.position.set(x, 5.35, 4.1)
    scene.add(arm)
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), lampBulbMat)
    bulb.position.set(x, 5.25, 3.6)
    scene.add(bulb)
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glow, color: '#ffb25a', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
    )
    halo.scale.set(5, 5, 1)
    halo.position.copy(bulb.position)
    scene.add(halo)
    lampSprites.push(halo)
    if (!lite && (i === 2 || i === 3)) {
      const light = new THREE.PointLight('#ffb25a', 18, 24, 1.8)
      light.position.set(x, 5, 3.4)
      scene.add(light)
      lampLights.push(light)
    }
  })

  // --- Lluvia ---------------------------------------------------------------
  const dropCount = lite ? 1400 : 3200
  const dropPos = new Float32Array(dropCount * 2 * 3)
  const dropTip = new Float32Array(dropCount * 2)
  const dropRand = new Float32Array(dropCount * 2)
  const rainH = 26
  for (let i = 0; i < dropCount; i += 1) {
    const x = (rand() - 0.5) * 70
    const y = rand() * rainH
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
  const rainUniforms = { uTime: { value: 0 }, uIntensity: { value: 0 }, uH: { value: rainH } }
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
          float speed = 16.0 + aRand * 8.0;
          float y = mod(position.y - uTime * speed, uH);
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

  // --- Mensajes: brasas que suben, algunas azules (el «visto») -----------------
  const emberCount = lite ? 120 : 260
  const emberPos = new Float32Array(emberCount * 3)
  const emberSeed = new Float32Array(emberCount)
  const emberBlue = new Float32Array(emberCount)
  for (let i = 0; i < emberCount; i += 1) {
    emberPos.set([(rand() - 0.5) * 50, rand() * 22, -8 + rand() * 38], i * 3)
    emberSeed[i] = rand()
    emberBlue[i] = rand() < 0.2 ? 1 : 0
  }
  const emberGeo = new THREE.BufferGeometry()
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3))
  emberGeo.setAttribute('aSeed', new THREE.BufferAttribute(emberSeed, 1))
  emberGeo.setAttribute('aBlue', new THREE.BufferAttribute(emberBlue, 1))
  const emberUniforms = { uTime: { value: 0 }, uOpacity: { value: 1 }, uPx: { value: 1 } }
  const embers = new THREE.Points(
    emberGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: emberUniforms,
      vertexShader: /* glsl */ `
        attribute float aSeed; attribute float aBlue;
        uniform float uTime; uniform float uPx; varying float vBlue; varying float vA;
        void main() {
          float y = mod(position.y + uTime * (0.35 + aSeed * 0.7), 24.0);
          vec3 p = position;
          p.y = y;
          p.x += sin(uTime * 0.4 + aSeed * 30.0) * 0.8;
          p.z += cos(uTime * 0.33 + aSeed * 17.0) * 0.8;
          vBlue = aBlue;
          vA = smoothstep(0.0, 3.0, y) * (1.0 - smoothstep(18.0, 24.0, y)) * (0.45 + 0.55 * aSeed);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (1.0 + aSeed * 2.6) * uPx * (22.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity; varying float vBlue; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vA * uOpacity;
          vec3 c = mix(vec3(1.0, 0.7, 0.28), vec3(0.33, 0.74, 0.92), vBlue);
          gl_FragColor = vec4(c, a);
        }`,
    }),
  )
  embers.frustumCulled = false
  scene.add(embers)

  // --- Cámara ---------------------------------------------------------------
  const camPts = [
    new THREE.Vector3(0, 2.4, 40), // 0 portada
    new THREE.Vector3(-3, 1.75, 11), // 1 llega
    new THREE.Vector3(1.8, 1.65, 4.6), // 2 agenda
    new THREE.Vector3(3.4, 1.55, 3.4), // 3 venta
    new THREE.Vector3(7, 1.9, 13), // 4 persona
    new THREE.Vector3(0, 24, 40), // 5 amanece
  ]
  const tgtPts = [
    new THREE.Vector3(-6, 40, -200),
    new THREE.Vector3(0, 2.7, -9),
    new THREE.Vector3(0.6, 3.0, -9),
    new THREE.Vector3(1.4, 2.3, -9),
    new THREE.Vector3(-5, 3.4, -4),
    new THREE.Vector3(8, 26, -220),
  ]
  const camCurve = new THREE.CatmullRomCurve3(camPts, false, 'centripetal')
  const tgtCurve = new THREE.CatmullRomCurve3(tgtPts, false, 'centripetal')
  const posTmp = new THREE.Vector3()
  const tgtTmp = new THREE.Vector3()
  const dirTmp = new THREE.Vector3()
  const rightTmp = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)

  // --- Post-proceso (solo en equipos con pantalla grande) --------------------
  let composer: EffectComposer | null = null
  let bloom: UnrealBloomPass | null = null
  if (!lite) {
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.7, 0.88)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
  }

  let width = 1
  let height = 1
  // Calidad adaptativa: si el equipo no da la talla, primero se apaga el bloom y luego baja la resolución.
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
    camera.fov = camera.aspect < 0.9 ? 52 : 38
    camera.updateProjectionMatrix()
    starUniforms.uPx.value = dpr
    emberUniforms.uPx.value = dpr * (height / 800)
  }
  resize()
  window.addEventListener('resize', resize)

  // Parallax suave con el puntero (solo punteros finos)
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 }
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth - 0.5) * 2
    pointer.y = (e.clientY / window.innerHeight - 0.5) * 2
  }
  if (!coarse) window.addEventListener('pointermove', onPointer, { passive: true })

  // --- Bucle ----------------------------------------------------------------
  let us = bus.u
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

    us += (bus.u - us) * (1 - Math.exp(-dt * 3.4))
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 2.2))
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 2.2))

    const k = clamp01(us / 5)
    camCurve.getPoint(k, posTmp)
    tgtCurve.getPoint(k, tgtTmp)

    // El sujeto queda a la derecha para dejarle lugar al texto (en pantallas anchas).
    if (camera.aspect > 1.15) {
      dirTmp.subVectors(tgtTmp, posTmp)
      const dist = dirTmp.length()
      rightTmp.crossVectors(dirTmp.normalize(), up).normalize()
      tgtTmp.addScaledVector(rightTmp, -0.18 * dist * smooth(0, 1, us) * 0.75)
    }
    // Respiración + parallax
    posTmp.x += Math.sin(t * 0.21) * 0.12 + pointer.sx * 0.25
    posTmp.y += Math.sin(t * 0.17) * 0.05 - pointer.sy * 0.1
    camera.position.copy(posTmp)
    camera.lookAt(tgtTmp)

    // Amanecer, lluvia y lámparas
    const dawn = smooth(4.15, 4.95, us)
    const rainAmount = smooth(2.5, 3.4, us) * (1 - smooth(4.35, 4.9, us))
    const lampLevel = 1 - dawn * 0.75

    skyUniforms.uTop.value.copy(NIGHT.skyTop).lerp(DAWN.skyTop, dawn)
    skyUniforms.uMid.value.copy(NIGHT.skyMid).lerp(DAWN.skyMid, dawn)
    skyUniforms.uHorizon.value.copy(NIGHT.skyHorizon).lerp(DAWN.skyHorizon, dawn)
    const fog = scene.fog as THREE.FogExp2
    fog.color.copy(NIGHT.fog).lerp(DAWN.fog, dawn)
    fog.density = lerp(0.0052, 0.0034, dawn)
    renderer.setClearColor(fog.color)
    hemi.color.copy(NIGHT.hemiSky).lerp(DAWN.hemiSky, dawn)
    hemi.groundColor.copy(NIGHT.hemiGround).lerp(DAWN.hemiGround, dawn)
    hemi.intensity = lerp(0.55, 0.85, dawn)
    moonLight.intensity = lerp(0.55, 0.15, dawn)

    starUniforms.uTime.value = t
    starUniforms.uOpacity.value = 1 - smooth(4.1, 4.7, us)
    rainUniforms.uTime.value = t
    rainUniforms.uIntensity.value = rainAmount
    rain.visible = rainAmount > 0.01
    emberUniforms.uTime.value = t
    emberUniforms.uOpacity.value = 0.9 - dawn * 0.5

    // La luna baja despacio; el sol sale por detrás de la cordillera.
    const moonT = smooth(0, 5, us)
    moonGroup.position.set(lerp(-110, -190, moonT), lerp(190, 36, moonT), -420)
    moonGroup.visible = dawn < 0.98
    moonHalo.material.opacity = 0.38 * (1 - dawn)
    const sunT = smooth(4.0, 5, us)
    sunGroup.position.set(60, lerp(-30, 132, sunT), -430)
    sunGroup.visible = sunT > 0.01
    sunHalo.material.opacity = 0.75 * sunT

    // Alpenglow en la cordillera
    const alp = new THREE.Color(1, 1, 1).lerp(new THREE.Color(1.9, 1.2, 1.0), dawn)
    ridges.forEach((r, i) => (r.material as THREE.MeshBasicMaterial).color.copy(alp).multiplyScalar(1 - i * 0.04))

    lampSprites.forEach((s, i) => {
      s.material.opacity = 0.85 * lampLevel * (0.94 + 0.06 * Math.sin(t * 2.1 + i))
    })
    lampLights.forEach((l) => (l.intensity = 18 * lampLevel))
    lampBulbMat.color.copy(AMBER).multiplyScalar(3 * lampLevel + 0.3)
    shopLight.intensity = 26 * (1 - dawn * 0.35)

    if (bloom) bloom.strength = lerp(0.42, 0.32, dawn)

    // Promedio móvil del tiempo de cuadro (sin contar pausas largas, como cambiar de pestaña).
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

  // Solo se dibuja mientras el escenario está en pantalla y la pestaña visible.
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
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose?.()
    })
    composer?.dispose()
    renderer.dispose()
    delete canvas.dataset.ready
  }
}
