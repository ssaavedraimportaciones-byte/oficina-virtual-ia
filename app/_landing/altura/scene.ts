import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { PLAN_H, PLAN_W, TABLES, tableCenter, type PlanTable } from './plan'

/**
 * Altura Bistró en 3D, con tratamiento de cine: atardecer con el sol bajo al
 * poniente, vidrios que reflejan el cielo, luces que brillan (bloom), grado de
 * color, viñeta y grano. Un edificio de 12 pisos con el restaurante arriba
 * (salón vidriado en el piso 11, terraza en el 12), la Torre Titanium al norte,
 * la cordillera al oriente y la ciudad con tráfico alrededor.
 *
 * La cámara gira alrededor del edificio; al elegir una mesa entra al salón por
 * el ventanal y se sienta a mirar la vista de esa mesa.
 *
 * Es una escena aparte del mundo de la landing: su propio lienzo, y solo dibuja
 * mientras está en pantalla. En celulares baja la resolución y la carga.
 *
 * Ejes: +X oriente (cordillera), -Z norte (torre), -X poniente (sol). Metros.
 */

export type AlturaView = { kind: 'orbit' } | { kind: 'table'; label: string } | { kind: 'terrace' }

export interface AlturaScene {
  setView(view: AlturaView): void
  setVisible(visible: boolean): void
  dispose(): void
}

const B = { w: 26, d: 18, base: 40, floor: 4.4 }
const SALON_Y = B.base + 0.4
const ROOF_Y = B.base + B.floor + 0.25
const TORRE = new THREE.Vector3(-55, 0, -250)
const TORRE_H = 182
const TORRE_LOOK = new THREE.Vector3(TORRE.x, 92, TORRE.z)
const CORDILLERA_LOOK = new THREE.Vector3(1400, 230, -60)
/** Dirección del sol: bajo, al poniente y un poco al norte, detrás de la torre. */
const SUN_DIR = new THREE.Vector3(-0.72, 0.09, -0.69).normalize()

function planToWorld(px: number, py: number): THREE.Vector3 {
  const x = -B.w / 2 + 1 + (px / PLAN_W) * (B.w - 2)
  const z = -B.d / 2 + 1 + (py / PLAN_H) * (B.d - 2)
  return new THREE.Vector3(x, SALON_Y, z)
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

/** Ruido de valor 2D con octavas: para el perfil de la cordillera. */
function makeNoise(seed: number) {
  const r = rng(seed)
  const table = Array.from({ length: 512 }, () => r())
  const at = (x: number, y: number) => table[((x * 73856093) ^ (y * 19349663)) & 511]
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const value = (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = smooth(x - xi)
    const yf = smooth(y - yi)
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * xf
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * xf
    return a + (b - a) * yf
  }
  return (x: number, y: number) => {
    let sum = 0
    let amp = 0.55
    let f = 1
    for (let o = 0; o < 5; o += 1) {
      sum += value(x * f, y * f) * amp
      f *= 2.1
      amp *= 0.5
    }
    return sum
  }
}

/** Fachada con ventanas: 9 x 16 por cuadro, algunas encendidas, cálidas o frías. */
function windowsTexture(seed: number, lit: number): THREE.CanvasTexture {
  const r = rng(seed)
  const tex = canvasTexture(128, 256, (ctx) => {
    ctx.fillStyle = '#0d111c'
    ctx.fillRect(0, 0, 128, 256)
    for (let y = 4; y < 256; y += 16) {
      for (let x = 3; x < 128; x += 14) {
        if (r() < lit) {
          ctx.fillStyle = r() < 0.78 ? '#ffcf8a' : '#cfe3ff'
          ctx.globalAlpha = 0.55 + r() * 0.45
        } else {
          ctx.fillStyle = '#1c2334'
          ctx.globalAlpha = 1
        }
        ctx.fillRect(x, y, 10, 11)
      }
    }
    ctx.globalAlpha = 1
  })
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

function textSprite(text: string, sub: string, scale: number): THREE.Sprite {
  const tex = canvasTexture(512, 160, (ctx) => {
    ctx.textAlign = 'center'
    ctx.shadowColor = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur = 16
    ctx.font = '600 50px "Archivo Variable", Arial, sans-serif'
    ctx.fillStyle = '#f4ecdf'
    ctx.fillText(text, 256, 70)
    if (sub) {
      ctx.font = '500 28px "JetBrains Mono Variable", monospace'
      ctx.fillStyle = '#ffb347'
      ctx.fillText(sub, 256, 118)
    }
  })
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, toneMapped: false }))
  sprite.scale.set(scale, scale * (160 / 512), 1)
  return sprite
}

function roundedRect(w: number, d: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -d / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + d - r)
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d)
  s.lineTo(x + r, y + d)
  s.quadraticCurveTo(x, y + d, x, y + d - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Cielo de atardecer calculado por dirección: degradé, halo y disco del sol. */
function skyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uSun: { value: SUN_DIR.clone() } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 zenith = vec3(0.035, 0.05, 0.13);
        vec3 high = vec3(0.16, 0.12, 0.30);
        vec3 mid = vec3(0.62, 0.26, 0.38);
        vec3 horizon = vec3(1.25, 0.58, 0.30);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.12, h));
        col = mix(col, high, smoothstep(0.1, 0.35, h));
        col = mix(col, zenith, smoothstep(0.35, 0.9, h));
        // Más luz del lado del sol; más fría del lado de la cordillera
        float toward = dot(normalize(vec3(d.x, 0.0001, d.z)), normalize(vec3(uSun.x, 0.0, uSun.z)));
        col *= mix(vec3(0.62, 0.7, 1.0), vec3(1.15, 1.0, 0.9), toward * 0.5 + 0.5);
        float s = max(dot(d, uSun), 0.0);
        col += vec3(1.6, 0.9, 0.45) * pow(s, 18.0) * 0.9;
        col += vec3(6.0, 4.6, 3.0) * smoothstep(0.9993, 0.9997, s);
        col = mix(col, horizon * 0.55, smoothstep(0.0, -0.08, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
}

/** Grado de cine en espacio lineal: aberración, saturación, tono partido, viñeta y grano. */
function gradePass(): ShaderPass {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse; uniform float uTime;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 c = vUv - 0.5;
        float r2 = dot(c, c);
        float a = 0.0025 * r2;
        vec3 col;
        col.r = texture2D(tDiffuse, vUv - c * a).r;
        col.g = texture2D(tDiffuse, vUv).g;
        col.b = texture2D(tDiffuse, vUv + c * a).b;
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(l), col, 1.18);
        col *= mix(vec3(0.9, 0.97, 1.12), vec3(1.08, 1.0, 0.9), smoothstep(0.02, 0.5, l));
        col *= mix(1.0, smoothstep(1.2, 0.15, r2 * 2.1), 0.6);
        float g = hash(vUv * vec2(1600.0, 900.0) + fract(uTime) * 91.0);
        col += (g - 0.5) * 0.018 * smoothstep(0.02, 0.4, l);
        gl_FragColor = vec4(max(col, 0.0), 1.0);
      }`,
  })
}

export function createAlturaScene(canvas: HTMLCanvasElement, opts: { motion: boolean; lite: boolean }): AlturaScene {
  const { lite } = opts
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.25 : 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = !lite
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2('#5a3a5c', 0.0006)
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 6000)

  // --- Cielo y reflejos ------------------------------------------------------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), skyMaterial())
  sky.frustumCulled = false
  scene.add(sky)
  // El mismo cielo, prefiltrado, es lo que reflejan los vidrios y los metales
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envScene = new THREE.Scene()
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMaterial()))
  const envRT = pmrem.fromScene(envScene, 0.02)
  scene.environment = envRT.texture
  scene.environmentIntensity = 0.9

  // --- Luz -----------------------------------------------------------------
  scene.add(new THREE.HemisphereLight('#8fa0d8', '#2a1820', 0.55))
  const sunLight = new THREE.DirectionalLight('#ffa560', 3.2)
  sunLight.position.copy(SUN_DIR).multiplyScalar(300)
  sunLight.target.position.set(0, 20, 0)
  scene.add(sunLight, sunLight.target)
  if (!lite) {
    sunLight.castShadow = true
    sunLight.shadow.mapSize.set(2048, 2048)
    const sc = sunLight.shadow.camera
    sc.left = -110
    sc.right = 110
    sc.top = 110
    sc.bottom = -110
    sc.near = 50
    sc.far = 700
    sunLight.shadow.bias = -0.0004
    sunLight.shadow.normalBias = 0.6
  }

  const r = rng(11)

  // --- Suelo, calles y tráfico ---------------------------------------------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: '#12151f', roughness: 0.95 }))
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const ROADS = Array.from({ length: 15 }, (_, i) => (i - 7) * 75 + 37)
  const roadMat = new THREE.MeshStandardMaterial({ color: '#272630', roughness: 0.55, metalness: 0.15 })
  for (const p of ROADS) {
    for (const vertical of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? 11 : 1500, vertical ? 1500 : 11), roadMat)
      road.rotation.x = -Math.PI / 2
      road.position.set(vertical ? p : 0, 0.04, vertical ? 0 : p)
      road.receiveShadow = true
      scene.add(road)
    }
  }

  // Faroles: el color por encima de 1 es lo que toma el bloom
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb85c').multiplyScalar(4) })
  const lampCount = lite ? 160 : 360
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 8, 6), lampMat, lampCount)
  lamps.frustumCulled = false
  const m4 = new THREE.Matrix4()
  for (let i = 0; i < lampCount; i += 1) {
    const road = ROADS[Math.floor(r() * ROADS.length)]
    const along = Math.round(((r() - 0.5) * 1400) / 25) * 25
    const side = r() < 0.5 ? -7 : 7
    if (r() < 0.5) m4.setPosition(road + side, 7, along)
    else m4.setPosition(along, 7, road + side)
    lamps.setMatrixAt(i, m4)
  }
  scene.add(lamps)

  // Autos: focos blancos hacia un lado, luces rojas hacia el otro
  type Car = { road: number; vertical: boolean; dir: 1 | -1; offset: number; speed: number }
  const carCount = lite ? 70 : 160
  const cars: Car[] = Array.from({ length: carCount }, () => ({
    road: ROADS[Math.floor(r() * ROADS.length)],
    vertical: r() < 0.5,
    dir: r() < 0.5 ? 1 : -1,
    offset: r() * 1500,
    speed: 9 + r() * 9,
  }))
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1d6').multiplyScalar(5) })
  const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a1a').multiplyScalar(5) })
  const carGeo = new THREE.BoxGeometry(1.8, 0.5, 0.9)
  const heads = new THREE.InstancedMesh(carGeo, headMat, carCount)
  const tails = new THREE.InstancedMesh(carGeo, tailMat, carCount)
  heads.frustumCulled = false
  tails.frustumCulled = false
  scene.add(heads, tails)
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
  const carQ = new THREE.Quaternion()
  const carPos = new THREE.Vector3()
  const one = new THREE.Vector3(1, 1, 1)
  const yAxis = new THREE.Vector3(0, 1, 0)
  function moveCars(time: number) {
    cars.forEach((c, i) => {
      const along = ((c.offset + time * c.speed) % 1500) - 750
      const lane = c.dir * 2.6
      carPos.set(c.vertical ? c.road + lane : along * c.dir, 0.8, c.vertical ? along * c.dir : c.road + lane)
      carQ.setFromAxisAngle(yAxis, c.vertical ? Math.PI / 2 : 0)
      m4.compose(carPos, carQ, one)
      // Hacia la cámara se ven los focos; de espaldas, las luces rojas
      ;(c.dir > 0 ? heads : tails).setMatrixAt(i, m4)
      ;(c.dir > 0 ? tails : heads).setMatrixAt(i, hidden)
    })
    heads.instanceMatrix.needsUpdate = true
    tails.instanceMatrix.needsUpdate = true
  }

  // --- Ciudad ---------------------------------------------------------------
  const cityTextures = [0, 1, 2, 3, 4].map((i) => windowsTexture(17 + i * 131, 0.3))
  const boxGeo = new THREE.BoxGeometry(1, 1, 1)
  const roofMat = new THREE.MeshStandardMaterial({ color: '#1d2130', roughness: 0.9 })
  for (let i = 0; i < (lite ? 90 : 190); i += 1) {
    const angle = r() * Math.PI * 2
    const dist = 60 + r() * 900
    const snap = (v: number) => Math.round(v / 75) * 75
    const x = snap(Math.cos(angle) * dist) + (r() - 0.5) * 30
    const z = snap(Math.sin(angle) * dist) + (r() - 0.5) * 30
    if (Math.hypot(x, z) < 45) continue
    if (Math.hypot(x - TORRE.x, z - TORRE.z) < 55) continue
    // Corredores de vista: de Altura hacia la torre y hacia la cordillera
    const t = z / TORRE.z
    if (z < -15 && t < 1.15 && Math.abs(x - TORRE.x * t) < 34) continue
    if (x > 18 && Math.abs(z) < 50) continue
    const w = 16 + r() * 26
    const d = 16 + r() * 26
    const h = dist < 180 ? 10 + r() * 24 : 14 + r() * (dist > 500 ? 110 : 70)
    const tex = cityTextures[i % cityTextures.length].clone()
    tex.repeat.set(w / 30, h / 52)
    tex.needsUpdate = true
    const facade = new THREE.MeshStandardMaterial({
      color: '#3a4256',
      map: tex,
      emissive: '#ffffff',
      emissiveMap: tex,
      emissiveIntensity: 0.9,
      roughness: 0.35,
      metalness: 0.4,
    })
    const b = new THREE.Mesh(boxGeo, [facade, facade, roofMat, roofMat, facade, facade])
    b.scale.set(w, h, d)
    b.position.set(x, h / 2, z)
    b.castShadow = !lite && dist < 200
    b.receiveShadow = !lite
    scene.add(b)
  }

  // --- Cordillera: un cordón con nieve, de norte a sur ----------------------
  const noise = makeNoise(5)
  const mDepth = 1400 // de poniente a oriente
  const mLength = 4200 // de norte a sur
  const mountGeo = new THREE.PlaneGeometry(mDepth, mLength, lite ? 70 : 140, lite ? 110 : 220)
  mountGeo.rotateX(-Math.PI / 2)
  const mp = mountGeo.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(mp.count * 3)
  const rock = new THREE.Color('#4a3d63')
  const rockHigh = new THREE.Color('#7a6890')
  const snowColor = new THREE.Color('#f6e6ef')
  const tmp = new THREE.Color()
  for (let i = 0; i < mp.count; i += 1) {
    const px = mp.getX(i)
    const pz = mp.getZ(i)
    // Sube hacia el oriente: la falda adelante, las cumbres atrás
    const rise = THREE.MathUtils.smoothstep(px, -mDepth * 0.45, mDepth * 0.15)
    const ridge = Math.pow(noise(pz * 0.0022 + 10, px * 0.0022), 1.5)
    const h = rise * (90 + ridge * 640) + noise(pz * 0.011, px * 0.011) * 45 * rise
    mp.setY(i, h)
    const snowLine = THREE.MathUtils.smoothstep(h, 340, 440)
    tmp.copy(rock).lerp(rockHigh, THREE.MathUtils.clamp(h / 420, 0, 1)).lerp(snowColor, snowLine)
    colors.set([tmp.r, tmp.g, tmp.b], i * 3)
  }
  mountGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  mountGeo.computeVertexNormals()
  const mountains = new THREE.Mesh(mountGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }))
  mountains.position.set(1050 + mDepth / 2, -5, 0)
  scene.add(mountains)

  // --- Torre Titanium -------------------------------------------------------
  const torreTex = canvasTexture(64, 512, (ctx) => {
    ctx.fillStyle = '#1b2c48'
    ctx.fillRect(0, 0, 64, 512)
    for (let y = 0; y < 512; y += 8) {
      ctx.fillStyle = '#9cc0ea'
      ctx.globalAlpha = 0.14
      ctx.fillRect(0, y, 64, 1)
      if (Math.random() < 0.22) {
        ctx.globalAlpha = 0.5 + Math.random() * 0.4
        ctx.fillStyle = Math.random() < 0.6 ? '#ffd9a0' : '#d6e8ff'
        ctx.fillRect(Math.floor(Math.random() * 40), y + 2, 10 + Math.random() * 20, 4)
      }
    }
    ctx.globalAlpha = 0.6
    ctx.fillStyle = '#0a1220'
    for (let x = 0; x < 64; x += 8) ctx.fillRect(x, 0, 1.5, 512)
    ctx.globalAlpha = 1
  })
  torreTex.wrapS = torreTex.wrapT = THREE.RepeatWrapping
  // Las caras laterales del extruido traen UV en metros: un piso cada ~3,8 m
  torreTex.repeat.set(1 / 24, 1 / 240)
  const torreGlass = new THREE.MeshPhysicalMaterial({
    color: '#5f86b8',
    map: torreTex,
    emissive: '#ffffff',
    emissiveMap: torreTex,
    emissiveIntensity: 0.6,
    metalness: 0.9,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.4,
  })
  const torreGeo = new THREE.ExtrudeGeometry(roundedRect(36, 28, 8), { depth: TORRE_H, bevelEnabled: false, curveSegments: 10 })
  torreGeo.rotateX(-Math.PI / 2)
  const torre = new THREE.Mesh(torreGeo, torreGlass)
  torre.position.copy(TORRE)
  torre.castShadow = !lite
  scene.add(torre)
  // Remate inclinado y antena con baliza
  const crownShape = new THREE.Shape([new THREE.Vector2(-18, 0), new THREE.Vector2(18, 0), new THREE.Vector2(18, 8), new THREE.Vector2(-18, 30)])
  const crownGeo = new THREE.ExtrudeGeometry(crownShape, { depth: 22, bevelEnabled: false })
  crownGeo.translate(0, 0, -11)
  const crown = new THREE.Mesh(crownGeo, new THREE.MeshPhysicalMaterial({ color: '#a9c8ee', metalness: 0.95, roughness: 0.1, clearcoat: 1, envMapIntensity: 1.6 }))
  crown.position.set(TORRE.x, TORRE_H, TORRE.z)
  scene.add(crown)
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 26, 6), new THREE.MeshStandardMaterial({ color: '#cfd6e0', metalness: 0.8, roughness: 0.3 }))
  mast.position.set(TORRE.x - 12, TORRE_H + 43, TORRE.z)
  scene.add(mast)
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2b2b').multiplyScalar(6), fog: false })
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), beaconMat)
  beacon.position.set(TORRE.x - 12, TORRE_H + 57, TORRE.z)
  scene.add(beacon)
  const torreLabel = textSprite('Torre Titanium', '', 95)
  torreLabel.position.set(TORRE.x, TORRE_H + 80, TORRE.z)
  scene.add(torreLabel)

  // --- Altura: el edificio --------------------------------------------------
  const facadeTex = windowsTexture(3, 0.24)
  facadeTex.repeat.set(B.w / 30, B.base / 52)
  const facade = new THREE.MeshStandardMaterial({
    color: '#454c62',
    map: facadeTex,
    emissive: '#ffffff',
    emissiveMap: facadeTex,
    emissiveIntensity: 0.8,
    roughness: 0.3,
    metalness: 0.5,
  })
  const lower = new THREE.Mesh(new THREE.BoxGeometry(B.w, B.base, B.d), facade)
  lower.position.y = B.base / 2
  lower.castShadow = !lite
  lower.receiveShadow = !lite
  scene.add(lower)
  // Pilastras en las esquinas: dan escala y sombra
  const pilasterMat = new THREE.MeshStandardMaterial({ color: '#c9c0b2', roughness: 0.6 })
  for (const [x, z] of [
    [-B.w / 2, -B.d / 2],
    [B.w / 2, -B.d / 2],
    [-B.w / 2, B.d / 2],
    [B.w / 2, B.d / 2],
  ]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, B.base + B.floor + 0.6, 1.2), pilasterMat)
    p.position.set(x, (B.base + B.floor + 0.6) / 2, z)
    p.castShadow = !lite
    scene.add(p)
  }
  // Acceso iluminado a nivel de calle
  const lobby = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd7a0').multiplyScalar(2.2) }))
  lobby.position.set(0, 2.2, B.d / 2 + 0.15)
  scene.add(lobby)

  const slabMat = new THREE.MeshStandardMaterial({ color: '#d8cfc0', roughness: 0.7 })
  const floorSlab = new THREE.Mesh(new THREE.BoxGeometry(B.w + 0.8, 0.45, B.d + 0.8), slabMat)
  floorSlab.position.y = B.base + 0.2
  floorSlab.castShadow = !lite
  scene.add(floorSlab)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(B.w + 1.2, 0.55, B.d + 1.2), slabMat)
  roof.position.y = B.base + B.floor
  roof.castShadow = !lite
  roof.receiveShadow = !lite
  scene.add(roof)

  // --- El salón del piso 11 ---------------------------------------------------
  const wood = new THREE.Mesh(new THREE.PlaneGeometry(B.w - 0.2, B.d - 0.2), new THREE.MeshStandardMaterial({ color: '#5c3d28', roughness: 0.35, metalness: 0.05 }))
  wood.rotation.x = -Math.PI / 2
  wood.position.y = SALON_Y + 0.01
  wood.receiveShadow = !lite
  scene.add(wood)
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(B.w - 0.4, B.d - 0.4), new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.9, side: THREE.DoubleSide }))
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = B.base + B.floor - 0.29
  scene.add(ceiling)
  // Lámparas colgantes
  const pendantMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc884').multiplyScalar(1.6) })
  const pendantGeo = new THREE.SphereGeometry(0.14, 12, 8)
  for (let x = -10; x <= 10; x += 4) {
    for (const z of [-4.5, 0, 4.5]) {
      const p = new THREE.Mesh(pendantGeo, pendantMat)
      p.position.set(x, B.base + B.floor - 1.2, z)
      scene.add(p)
    }
  }
  for (const [x, z] of [
    [-7, -3],
    [7, -3],
    [0, 4],
  ]) {
    const light = new THREE.PointLight('#ffbf7a', 38, 20, 1.6)
    light.position.set(x, B.base + 3.2, z)
    scene.add(light)
  }

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#cfe2ff',
    metalness: 0.15,
    roughness: 0.03,
    transparent: true,
    opacity: 0.05,
    envMapIntensity: 0.5,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const glass = new THREE.Mesh(new THREE.BoxGeometry(B.w, B.floor - 0.65, B.d), glassMat)
  glass.position.y = SALON_Y + (B.floor - 0.65) / 2
  scene.add(glass)
  const mullionMat = new THREE.MeshStandardMaterial({ color: '#111520', metalness: 0.7, roughness: 0.35 })
  const mullionGeo = new THREE.BoxGeometry(0.14, B.floor - 0.65, 0.14)
  const mullionY = SALON_Y + (B.floor - 0.65) / 2
  for (let x = -B.w / 2; x <= B.w / 2 + 0.01; x += B.w / 8) {
    for (const z of [-B.d / 2, B.d / 2]) {
      const m = new THREE.Mesh(mullionGeo, mullionMat)
      m.position.set(x, mullionY, z)
      scene.add(m)
    }
  }
  for (let z = -B.d / 2; z <= B.d / 2 + 0.01; z += B.d / 6) {
    for (const x of [-B.w / 2, B.w / 2]) {
      const m = new THREE.Mesh(mullionGeo, mullionMat)
      m.position.set(x, mullionY, z)
      scene.add(m)
    }
  }
  // Barra de cócteles con su luz
  const barPos = planToWorld(99, 256)
  const bar = new THREE.Mesh(new THREE.BoxGeometry(8, 1.1, 1.4), new THREE.MeshStandardMaterial({ color: '#3b2416', roughness: 0.4, metalness: 0.2 }))
  bar.position.set(barPos.x, SALON_Y + 0.55, barPos.z)
  scene.add(bar)
  const barGlow = new THREE.Mesh(new THREE.BoxGeometry(8, 0.05, 1.4), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffae5c').multiplyScalar(2.5) }))
  barGlow.position.set(barPos.x, SALON_Y + 1.13, barPos.z)
  scene.add(barGlow)

  // Mesas: las mismas del croquis, con mantel, sillas, copas y vela
  const clothMat = new THREE.MeshStandardMaterial({ color: '#f4eee4', roughness: 0.85 })
  const takenMat = new THREE.MeshStandardMaterial({ color: '#e7d2c8', roughness: 0.85 })
  const chairMat = new THREE.MeshStandardMaterial({ color: '#2a201a', roughness: 0.55 })
  const metalMat = new THREE.MeshStandardMaterial({ color: '#b9a27a', metalness: 0.9, roughness: 0.25 })
  const cupMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, transparent: true, opacity: 0.35, envMapIntensity: 2 })
  const candleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf7a').multiplyScalar(3) })
  const seatGeo = new THREE.BoxGeometry(0.46, 0.08, 0.46)
  const backGeo = new THREE.BoxGeometry(0.46, 0.55, 0.06)
  const cupGeo = new THREE.CylinderGeometry(0.035, 0.025, 0.16, 10)
  const candleGeo = new THREE.SphereGeometry(0.045, 8, 6)
  const tablePositions = new Map<string, THREE.Vector3>()
  for (const t of TABLES) {
    const c = tableCenter(t)
    const p = planToWorld(c.x, c.y)
    tablePositions.set(t.label, p)
    const group = new THREE.Group()
    group.position.copy(p)
    const mat = t.tone === 'tomada' ? takenMat : clothMat
    let half: { x: number; z: number }
    let top: THREE.Mesh
    if (t.r) {
      top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.1, 32), mat)
      half = { x: 0.62, z: 0.62 }
    } else {
      const w = ((t.w ?? 40) / PLAN_W) * (B.w - 2) * 0.62
      const d = ((t.h ?? 40) / PLAN_H) * (B.d - 2) * 0.62
      top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), mat)
      half = { x: w / 2, z: d / 2 }
    }
    top.position.y = 0.76
    top.castShadow = !lite
    top.receiveShadow = !lite
    group.add(top)
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.18, 0.72, 10), metalMat)
    leg.position.y = 0.36
    group.add(leg)
    const n = Math.min(t.seats, 8)
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n
      const chair = new THREE.Group()
      const seat = new THREE.Mesh(seatGeo, chairMat)
      seat.position.y = 0.46
      const back = new THREE.Mesh(backGeo, chairMat)
      back.position.set(0, 0.76, 0.2)
      chair.add(seat, back)
      chair.position.set(Math.cos(a) * (half.x + 0.42), 0, Math.sin(a) * (half.z + 0.42))
      // El respaldo hacia afuera, el asiento mirando a la mesa
      chair.rotation.y = Math.PI / 2 - a
      group.add(chair)
      const cup = new THREE.Mesh(cupGeo, cupMat)
      cup.position.set(Math.cos(a) * half.x * 0.6, 0.89, Math.sin(a) * half.z * 0.6)
      group.add(cup)
    }
    const candle = new THREE.Mesh(candleGeo, candleMat)
    candle.position.y = 0.88
    group.add(candle)
    scene.add(group)
  }

  // Anillo luminoso que marca la mesa elegida
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fde68a').multiplyScalar(2.5), transparent: true, opacity: 0.9 })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.035, 8, 64), ringMat)
  ring.rotation.x = Math.PI / 2
  ring.visible = false
  scene.add(ring)

  // --- Terraza del piso 12 ---------------------------------------------------
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(B.w, B.d), new THREE.MeshStandardMaterial({ color: '#4d3f33', roughness: 0.7 }))
  deck.rotation.x = -Math.PI / 2
  deck.position.y = ROOF_Y + 0.01
  deck.receiveShadow = !lite
  scene.add(deck)
  const railMat = new THREE.MeshPhysicalMaterial({ color: '#d7ecff', transparent: true, opacity: 0.2, roughness: 0.03, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.5 })
  for (const [w, d, x, z] of [
    [B.w, 0.06, 0, -B.d / 2],
    [B.w, 0.06, 0, B.d / 2],
    [0.06, B.d, -B.w / 2, 0],
    [0.06, B.d, B.w / 2, 0],
  ]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), railMat)
    rail.position.set(x, ROOF_Y + 0.55, z)
    scene.add(rail)
  }
  // Guirnaldas de ampolletas
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf85').multiplyScalar(2.2) })
  const bulbGeo = new THREE.SphereGeometry(0.06, 8, 6)
  for (const z of [-B.d / 2 + 0.6, -2, 3, B.d / 2 - 0.6]) {
    for (let i = 0; i <= 52; i += 1) {
      const u = i / 52
      const bulb = new THREE.Mesh(bulbGeo, bulbMat)
      bulb.position.set(-B.w / 2 + u * B.w, ROOF_Y + 2.7 - Math.sin(u * Math.PI * 3) ** 2 * 0.45, z)
      scene.add(bulb)
    }
  }
  for (const [x, z] of [
    [-9, -6.5], [-4, -6.5], [1, -6.5], [6, -6.5], [-7, 0.5], [-1, 0.5], [5, 1], [-4, 6], [3, 6],
  ]) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.06, 24), clothMat)
    top.position.set(x, ROOF_Y + 0.75, z)
    top.castShadow = !lite
    scene.add(top)
    const candle = new THREE.Mesh(candleGeo, candleMat)
    candle.position.set(x, ROOF_Y + 0.84, z)
    scene.add(candle)
  }
  const sign = textSprite('Altura Bistró', 'pisos 11 y 12', 30)
  sign.position.set(0, ROOF_Y + 9, 0)
  scene.add(sign)

  // --- Post-proceso -----------------------------------------------------------
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const BLOOM_OUT = lite ? 0.55 : 0.75
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM_OUT, 0.55, 0.86)
  composer.addPass(bloom)
  const grade = gradePass()
  composer.addPass(grade)
  composer.addPass(new OutputPass())

  // --- Cámara -----------------------------------------------------------------
  const ORBIT_TARGET = new THREE.Vector3(0, 36, 0)
  let orbitAngle = 0.9
  const orbitPos = (a: number, time: number) =>
    new THREE.Vector3(Math.cos(a) * 88, 52 + Math.sin(time * 0.17) * 9, Math.sin(a) * 88)

  let clock = 0
  const camPos = orbitPos(orbitAngle, 0)
  const camLook = ORBIT_TARGET.clone()
  let fov = 36

  type Flight = {
    from: THREE.Vector3
    via: THREE.Vector3 | null
    to: THREE.Vector3
    lookFrom: THREE.Vector3
    lookTo: THREE.Vector3
    fovFrom: number
    fovTo: number
    started: number
    dur: number
  }
  let flight: Flight | null = null
  let view: AlturaView = { kind: 'orbit' }

  function lookFor(v: AlturaView): THREE.Vector3 {
    if (v.kind === 'table') {
      const t = TABLES.find((x) => x.label === v.label) as PlanTable
      return t.facing === 'cordillera' ? CORDILLERA_LOOK : TORRE_LOOK
    }
    if (v.kind === 'terrace') return TORRE_LOOK
    return ORBIT_TARGET
  }

  function shotFor(v: AlturaView): { pos: THREE.Vector3; look: THREE.Vector3; via: THREE.Vector3 | null; fov: number } {
    if (v.kind === 'table') {
      const p = (tablePositions.get(v.label) ?? new THREE.Vector3(0, SALON_Y, 0)).clone()
      const look = lookFor(v)
      const dir = look.clone().sub(p).setY(0).normalize()
      // Sentado detrás de la mesa, un poco al costado: se ve la mesa, el ventanal y la vista
      const side = new THREE.Vector3(-dir.z, 0, dir.x)
      const pos = p.clone().addScaledVector(dir, -2.4).addScaledVector(side, 0.6).setY(SALON_Y + 1.3)
      // Se entra por el ventanal, no atravesando el techo
      const via = p.clone().addScaledVector(dir, 45).setY(SALON_Y + 8)
      return { pos, look, via, fov: 48 }
    }
    if (v.kind === 'terrace') {
      return { pos: new THREE.Vector3(3, ROOF_Y + 1.65, 5.5), look: TORRE_LOOK, via: new THREE.Vector3(30, ROOF_Y + 30, 60), fov: 46 }
    }
    return { pos: orbitPos(orbitAngle, clock), look: ORBIT_TARGET.clone(), via: null, fov: 36 }
  }

  function setView(v: AlturaView) {
    view = v
    ring.visible = v.kind === 'table'
    sign.visible = v.kind === 'orbit'
    if (v.kind === 'table') {
      const p = tablePositions.get(v.label)
      if (p) ring.position.set(p.x, SALON_Y + 0.04, p.z)
    }
    if (v.kind === 'orbit') orbitAngle = Math.atan2(camPos.z, camPos.x)
    const shot = shotFor(v)
    if (v.kind === 'orbit' && camPos.y < ROOF_Y + 6) {
      // Salir del salón por el ventanal más cercano
      const out = new THREE.Vector3(camPos.x, 0, camPos.z).normalize()
      shot.via = camPos.clone().addScaledVector(out, 45).setY(camPos.y + 6)
    }
    if (!opts.motion) {
      camPos.copy(shot.pos)
      camLook.copy(shot.look)
      fov = shot.fov
      flight = null
      draw()
      return
    }
    // Por reloj y no por cuadros: en un equipo lento el vuelo dura lo mismo
    flight = {
      from: camPos.clone(),
      via: shot.via,
      to: shot.pos,
      lookFrom: camLook.clone(),
      lookTo: shot.look,
      fovFrom: fov,
      fovTo: shot.fov,
      started: performance.now(),
      dur: 3400,
    }
    start()
  }

  // --- Ciclo ------------------------------------------------------------------
  let visible = false
  let raf = 0
  let last = 0
  let width = 0
  let height = 0

  function resize() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h || (w === width && h === height)) return
    width = w
    height = h
    renderer.setSize(w, h, false)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(w, h)
    if (lite) bloom.resolution.set(w * 0.5, h * 0.5)
  }

  /**
   * Adentro del salón o en la terraza las luces quedan a centímetros del lente:
   * con el mismo brillo y exposición de afuera, la imagen se quema.
   */
  function exposeFor(pos: THREE.Vector3) {
    const near = 1 - THREE.MathUtils.smoothstep(Math.hypot(pos.x, pos.z), 16, 40)
    const level = 1 - THREE.MathUtils.smoothstep(Math.abs(pos.y - (SALON_Y + 2)), 4, 14)
    const inside = near * level
    renderer.toneMappingExposure = 1 - inside * 0.3
    bloom.strength = BLOOM_OUT + (0.22 - BLOOM_OUT) * inside
  }

  function draw() {
    resize()
    exposeFor(camPos)
    camera.aspect = width / Math.max(1, height)
    camera.fov = fov
    camera.position.copy(camPos)
    camera.lookAt(camLook)
    camera.updateProjectionMatrix()
    grade.uniforms.uTime.value = clock
    composer.render()
  }

  const drift = new THREE.Vector3()
  function frame(now: number) {
    raf = 0
    const dt = Math.min(0.1, last ? (now - last) / 1000 : 0)
    last = now
    clock += dt

    if (flight) {
      const t = Math.min(1, (now - flight.started) / flight.dur)
      const k = easeInOut(t)
      if (flight.via) {
        const a = flight.from.clone().lerp(flight.via, k)
        const b = flight.via.clone().lerp(flight.to, k)
        camPos.copy(a.lerp(b, k))
      } else {
        camPos.copy(flight.from).lerp(flight.to, k)
      }
      camLook.copy(flight.lookFrom).lerp(flight.lookTo, easeInOut(Math.min(1, t * 1.25)))
      fov = flight.fovFrom + (flight.fovTo - flight.fovFrom) * k
      if (t >= 1) flight = null
    } else if (view.kind === 'orbit') {
      orbitAngle += dt * 0.09
      camPos.copy(orbitPos(orbitAngle, clock))
      camLook.copy(ORBIT_TARGET)
    } else {
      // Sentado a la mesa: la mirada se pasea apenas, como quien mira por la ventana
      drift.set(Math.sin(clock * 0.31) * 3.5, Math.sin(clock * 0.23) * 1.6, Math.cos(clock * 0.27) * 2.5)
      camLook.copy(lookFor(view)).add(drift)
    }

    ringMat.opacity = 0.55 + Math.sin(clock * 3) * 0.35
    beaconMat.color.setRGB(Math.sin(clock * 2.2) > 0.3 ? 6 : 0.4, 0.2, 0.2)
    moveCars(clock)

    draw()
    if (visible && opts.motion) raf = requestAnimationFrame(frame)
  }

  function start() {
    if (!raf && visible && opts.motion) {
      last = 0
      raf = requestAnimationFrame(frame)
    }
  }

  const onResize = () => (opts.motion ? start() : draw())
  window.addEventListener('resize', onResize)
  moveCars(0)
  draw()

  return {
    setView,
    setVisible(v) {
      visible = v
      if (v) start()
      else if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    },
    dispose() {
      visible = false
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      const done = new Set<unknown>()
      const free = (x: { dispose(): void } | null | undefined) => {
        if (!x || done.has(x)) return
        done.add(x)
        x.dispose()
      }
      for (const root of [scene, envScene]) {
        root.traverse((o) => {
          const mesh = o as THREE.Mesh
          free(mesh.geometry)
          const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
          if (!mat) return
          for (const m of Array.isArray(mat) ? mat : [mat]) {
            const textured = m as THREE.MeshStandardMaterial
            free(textured.map)
            free(textured.emissiveMap)
            free(m)
          }
        })
      }
      envRT.dispose()
      pmrem.dispose()
      composer.dispose()
      renderer.dispose()
    },
  }
}
