import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Light } from './palette'
import {
  asphaltTexture,
  barkTexture,
  curtainTexture,
  facadeTexture,
  glowTexture,
  groundRoughness,
  leafClusterTexture,
  mulberry32,
  railingTexture,
  sidewalkTexture,
} from './textures'

/**
 * La ciudad: calle, veredas, edificios con ventanas y balcones, postes con
 * cables, faroles con su cono de luz, plátanos orientales, autos estacionados
 * y neblina baja. Lo estático se fusiona en pocas mallas para gastar pocas
 * llamadas de dibujo.
 */

export const FRONT_Z = -9
export const FACE_Z = FRONT_Z + 3.5 + 0.03
export const ANA = new THREE.Vector3(-7.9, 6.2, FACE_Z)
export const OWNER = new THREE.Vector3(8.3, 8.6, FACE_Z)
/** Ejemplo de la urgencia dental, al final de la calle de rubros: el edificio de
 *  la clínica, el de Camila (la paciente) y sus ventanas (ver world/dental.ts). */
export const CLINIC_BLOCK = { x: 80, w: 9, h: 12.4 }
export const HOME_BLOCK = { x: 88.2, w: 7, h: 10.6 }
export const CAMILA = new THREE.Vector3(86.1, 6.4, FACE_Z)
export const ROJAS = new THREE.Vector3(77.6, 6.4, FACE_Z)

/** Una fuente de luz que se refleja en la calle mojada. */
export interface Emitter {
  pos: THREE.Vector3
  color: THREE.Color
  size: number
  level: () => number
}

/** Caja con UV en unidades del mundo: la textura conserva su escala en edificios de cualquier tamaño. */
export function worldBox(w: number, h: number, d: number, scale = 4.2) {
  const geo = new THREE.BoxGeometry(w, h, d)
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute
  // Orden de caras de BoxGeometry: +x, -x, +y, -y, +z, -z (4 vértices cada una)
  const dims: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ]
  for (let f = 0; f < 6; f += 1) {
    for (let k = 0; k < 4; k += 1) {
      const i = f * 4 + k
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / scale, (uv.getY(i) * dims[f][1]) / scale)
    }
  }
  return geo
}

function colorize(geo: THREE.BufferGeometry, color: THREE.Color) {
  const n = geo.getAttribute('position').count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i += 1) arr.set([color.r, color.g, color.b], i * 3)
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}

interface Block {
  x: number
  w: number
  h: number
  z: number
  d: number
  color: string
  /** Probabilidad de ventana encendida. */
  lit: number
  balconies?: boolean
  roof?: boolean
  /** Piso de abajo libre (locales comerciales). */
  shopFloor?: boolean
  /** 1 = mira a la calle desde el fondo (+z); -1 = vereda de la cámara (mira hacia -z). */
  facing?: 1 | -1
  windows?: boolean
}

export function createCity(scene: THREE.Scene, opts: { lite: boolean; reserved: { x: number; y: number }[] }) {
  const rand = mulberry32(99)
  const emitters: Emitter[] = []
  const lightLevel = { lamps: 1, windows: 1, wet: 1, mist: 1 }

  // --- Suelo ------------------------------------------------------------------
  const asphalt = asphaltTexture()
  asphalt.repeat.set(60, 14)
  const rough = groundRoughness()
  rough.repeat.set(40, 9)
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughnessMap: rough, roughness: 1, metalness: 0.05, envMapIntensity: 0.9 })
  const road = new THREE.Mesh(new THREE.PlaneGeometry(420, 120), roadMat)
  let wetRoad = true
  road.rotation.x = -Math.PI / 2
  road.position.set(20, 0, 0)
  road.receiveShadow = true
  scene.add(road)

  const tiles = sidewalkTexture()
  tiles.repeat.set(140, 2)
  const sidewalkMat = new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.75, color: '#9a978f' })
  const curbMat = new THREE.MeshStandardMaterial({ color: '#7b7872', roughness: 0.8 })
  for (const [z, d] of [
    [-4.1, 4.2],
    [6.4, 4.2],
  ] as const) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(420, 0.16, d), sidewalkMat)
    s.position.set(20, 0.08, z)
    s.receiveShadow = true
    scene.add(s)
    const curb = new THREE.Mesh(new THREE.BoxGeometry(420, 0.2, 0.22), curbMat)
    curb.position.set(20, 0.1, z > 0 ? z - d / 2 : z + d / 2)
    scene.add(curb)
  }

  // Línea central segmentada y paso de cebra a la izquierda de la cuadra
  const paintMat = new THREE.MeshStandardMaterial({ color: '#d9d6cf', roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 })
  const dashes: THREE.BufferGeometry[] = []
  for (let x = -180; x < 220; x += 6) {
    const g = new THREE.PlaneGeometry(3, 0.14)
    g.rotateX(-Math.PI / 2)
    g.translate(x, 0.012, 1.15)
    dashes.push(g)
  }
  for (let i = 0; i < 9; i += 1) {
    const g = new THREE.PlaneGeometry(0.55, 1.6)
    g.rotateX(-Math.PI / 2)
    g.rotateY(Math.PI / 2)
    g.translate(-12.2, 0.013, -1.4 + i * 0.66)
    // franjas paralelas a la calle: cada una cruza a lo largo de z
    dashes.push(g)
  }
  scene.add(new THREE.Mesh(mergeGeometries(dashes), paintMat))

  // --- Edificios ----------------------------------------------------------------
  const facade = facadeTexture()
  const buildingGeos: THREE.BufferGeometry[] = []
  const windowSlots: { x: number; y: number; z: number; dir: 1 | -1; lit: boolean }[] = []
  const balconySlots: { x: number; y: number; z: number; dir: 1 | -1 }[] = []
  const acSlots: { x: number; y: number; z: number; dir: 1 | -1 }[] = []
  const roofSlots: { x: number; y: number; z: number; kind: 'tank' | 'antenna' }[] = []

  const add = (b: Block) => {
    const facing = b.facing ?? 1
    const geo = worldBox(b.w, b.h, b.d)
    geo.translate(b.x, b.h / 2, b.z)
    buildingGeos.push(colorize(geo, new THREE.Color(b.color)))
    // Parapeto del techo
    const par = worldBox(b.w + 0.2, 0.5, b.d + 0.2)
    par.translate(b.x, b.h + 0.25, b.z)
    buildingGeos.push(colorize(par, new THREE.Color(b.color).multiplyScalar(0.8)))
    if (b.roof) {
      const n = 1 + Math.floor(rand() * 2)
      for (let i = 0; i < n; i += 1) {
        roofSlots.push({ x: b.x - b.w / 3 + rand() * (b.w * 0.66), y: b.h + 0.5, z: b.z - b.d / 4 + rand() * (b.d / 2), kind: rand() > 0.5 ? 'tank' : 'antenna' })
      }
    }
    if (b.windows === false) return
    const faceZ = b.z + (facing * b.d) / 2
    const cols = Math.max(1, Math.floor(b.w / 1.75))
    const rows = Math.max(1, Math.floor((b.h - 2.4) / 2.1))
    for (let r = b.shopFloor ? 1 : 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const wx = b.x - b.w / 2 + (c + 0.5) * (b.w / cols)
        const wy = 2.2 + r * 2.1
        if (wy > b.h - 1) continue
        if (opts.reserved.some((p) => Math.abs(p.x - wx) < 1.4 && Math.abs(p.y - wy) < 1.6)) continue
        windowSlots.push({ x: wx, y: wy, z: faceZ, dir: facing, lit: rand() < b.lit })
        if (b.balconies && r >= 1 && c % 2 === 0) balconySlots.push({ x: wx, y: wy - 0.82, z: faceZ, dir: facing })
        if (rand() < 0.12) acSlots.push({ x: wx + 0.78, y: wy - 0.55, z: faceZ, dir: facing })
      }
    }
  }

  // La cuadra de la historia: edificio de Ana y edificio de Caro (el local va aparte)
  add({ x: -7.25, w: 7.3, h: 10, z: FRONT_Z, d: 7, color: '#6f6a74', lit: 0.1, balconies: true, roof: true, shopFloor: true })
  add({ x: 7.45, w: 7.7, h: 12.6, z: FRONT_Z, d: 7, color: '#7a6f66', lit: 0.1, balconies: true, roof: true, shopFloor: true })
  // Hacia la izquierda
  const palette = ['#77736e', '#6b6f78', '#8a7f72', '#5f6672', '#827a70', '#6d6a63', '#7f8790']
  let cursor = -10.9
  while (cursor > -150) {
    const w = 5 + rand() * 4
    const h = 6 + rand() * 14
    add({ x: cursor - w / 2 - 0.1, w, h, z: FRONT_Z, d: 7, color: palette[Math.floor(rand() * palette.length)], lit: 0.32, balconies: h > 11, roof: rand() > 0.4, shopFloor: rand() > 0.4 })
    cursor -= w + 0.2
  }
  // Después de la calle de rubros (x 12..75): primero los dos edificios fijos del ejemplo dental
  add({ x: CLINIC_BLOCK.x, w: CLINIC_BLOCK.w, h: CLINIC_BLOCK.h, z: FRONT_Z, d: 7, color: '#8a8580', lit: 0.25, balconies: true, roof: true, shopFloor: true })
  add({ x: HOME_BLOCK.x, w: HOME_BLOCK.w, h: HOME_BLOCK.h, z: FRONT_Z, d: 7, color: '#6b6f78', lit: 0.35, balconies: true, roof: true })
  cursor = HOME_BLOCK.x + HOME_BLOCK.w / 2 + 0.1
  while (cursor < 200) {
    const w = 5 + rand() * 4
    const h = 6 + rand() * 14
    add({ x: cursor + w / 2 + 0.1, w, h, z: FRONT_Z, d: 7, color: palette[Math.floor(rand() * palette.length)], lit: 0.32, balconies: h > 11, roof: rand() > 0.4, shopFloor: rand() > 0.4 })
    cursor += w + 0.2
  }
  // Vereda de la cámara, solo frente a la calle de rubros (se ve desde arriba): casas bajas
  for (let x = 14; x < 120; ) {
    const w = 5 + rand() * 4
    const h = 3.6 + rand() * 3.4
    add({ x: x + w / 2, w, h, z: 15, d: 7, color: palette[Math.floor(rand() * palette.length)], lit: 0.25, facing: -1, roof: rand() > 0.5, balconies: h > 10 })
    x += w + 0.2
  }
  // Segunda y tercera fila
  for (let x = -160; x < 220; x += 7 + rand() * 6) {
    const h = 9 + rand() * 18
    add({ x, w: 6 + rand() * 6, h, z: -34 - rand() * 22, d: 10, color: palette[Math.floor(rand() * palette.length)], lit: 0.22, roof: true })
  }
  // Torres lejanas: dan el horizonte de ciudad grande, a los costados para no tapar la cordillera
  for (let i = 0; i < 18; i += 1) {
    const side = i % 2 === 0 ? -1 : 1
    const x = side < 0 ? -90 - rand() * 160 : 110 + rand() * 160
    const h = 30 + rand() * 50
    add({ x, w: 10 + rand() * 10, h, z: -95 - rand() * 50, d: 12, color: rand() > 0.5 ? '#4f5866' : '#5d636b', lit: 0.3 })
  }

  const buildingMat = new THREE.MeshStandardMaterial({ map: facade, vertexColors: true, roughness: 0.92, metalness: 0 })
  const buildings = new THREE.Mesh(mergeGeometries(buildingGeos), buildingMat)
  buildings.castShadow = true
  buildings.receiveShadow = true
  scene.add(buildings)

  // Ventanas: marco + vidrio (encendido con cortinas, o vidrio oscuro que refleja el cielo) + alféizar
  const dummy = new THREE.Object3D()
  const place = (x: number, y: number, z: number, dir: 1 | -1, sx = 1, sy = 1, sz = 1) => {
    dummy.position.set(x, y, z)
    dummy.rotation.set(0, dir === 1 ? 0 : Math.PI, 0)
    dummy.scale.set(sx, sy, sz)
    dummy.updateMatrix()
    return dummy.matrix
  }
  const frames = new THREE.InstancedMesh(new THREE.BoxGeometry(1.12, 1.42, 0.1), new THREE.MeshStandardMaterial({ color: '#23252b', roughness: 0.6 }), windowSlots.length)
  const sills = new THREE.InstancedMesh(new THREE.BoxGeometry(1.26, 0.08, 0.22), new THREE.MeshStandardMaterial({ color: '#a7a39a', roughness: 0.8 }), windowSlots.length)
  const litSlots = windowSlots.filter((s) => s.lit)
  const darkSlots = windowSlots.filter((s) => !s.lit)
  const litMat = new THREE.MeshBasicMaterial({ map: curtainTexture(), color: 0xffffff })
  const litPanes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.94, 1.24), litMat, Math.max(1, litSlots.length))
  const darkPanes = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.94, 1.24),
    new THREE.MeshStandardMaterial({ color: '#141a26', roughness: 0.12, metalness: 0.85, envMapIntensity: 1.2 }),
    Math.max(1, darkSlots.length),
  )
  windowSlots.forEach((s, i) => {
    frames.setMatrixAt(i, place(s.x, s.y, s.z + s.dir * 0.04, s.dir))
    sills.setMatrixAt(i, place(s.x, s.y - 0.74, s.z + s.dir * 0.1, s.dir))
  })
  const tint = new THREE.Color()
  litSlots.forEach((s, i) => {
    litPanes.setMatrixAt(i, place(s.x, s.y, s.z + s.dir * 0.1, s.dir))
    tint.setHSL(0.07 + rand() * 0.05, 0.5 + rand() * 0.3, 0.45 + rand() * 0.25)
    if (rand() < 0.18) tint.setHSL(0.6, 0.15, 0.6) // alguna luz fría (tele encendida)
    litPanes.setColorAt(i, tint)
  })
  darkSlots.forEach((s, i) => darkPanes.setMatrixAt(i, place(s.x, s.y, s.z + s.dir * 0.1, s.dir)))
  for (const m of [frames, sills, litPanes, darkPanes]) {
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    scene.add(m)
  }
  frames.castShadow = true

  // Balcones
  const slab = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.12, 0.8), new THREE.MeshStandardMaterial({ color: '#8d8a84', roughness: 0.85 }), Math.max(1, balconySlots.length))
  const railMat = new THREE.MeshStandardMaterial({ map: railingTexture(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 })
  const rails = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.5, 0.95), railMat, Math.max(1, balconySlots.length))
  balconySlots.forEach((s, i) => {
    slab.setMatrixAt(i, place(s.x, s.y, s.z + s.dir * 0.4, s.dir))
    rails.setMatrixAt(i, place(s.x, s.y + 0.52, s.z + s.dir * 0.8, s.dir))
  })
  slab.castShadow = true
  for (const m of [slab, rails]) {
    m.instanceMatrix.needsUpdate = true
    scene.add(m)
  }

  // Equipos de aire acondicionado
  const ac = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.42, 0.34), new THREE.MeshStandardMaterial({ color: '#c9c8c2', roughness: 0.55 }), Math.max(1, acSlots.length))
  acSlots.forEach((s, i) => ac.setMatrixAt(i, place(s.x, s.y, s.z + s.dir * 0.18, s.dir)))
  ac.instanceMatrix.needsUpdate = true
  scene.add(ac)

  // Techos: estanques de agua y antenas
  const tanks = roofSlots.filter((r) => r.kind === 'tank')
  const antennas = roofSlots.filter((r) => r.kind === 'antenna')
  const tankMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 14), new THREE.MeshStandardMaterial({ color: '#5a5f63', roughness: 0.5, metalness: 0.3 }), Math.max(1, tanks.length))
  tanks.forEach((r, i) => tankMesh.setMatrixAt(i, place(r.x, r.y + 0.95, r.z, 1)))
  const antMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.04, 2.6, 5), new THREE.MeshStandardMaterial({ color: '#2b2e33', metalness: 0.6, roughness: 0.4 }), Math.max(1, antennas.length))
  antennas.forEach((r, i) => antMesh.setMatrixAt(i, place(r.x, r.y + 1.3, r.z, 1)))
  for (const m of [tankMesh, antMesh]) {
    m.instanceMatrix.needsUpdate = true
    m.castShadow = true
    scene.add(m)
  }

  // --- Postes y cables -----------------------------------------------------------
  const poleXs = [-34, -12.2, 12.4, 24, 36, 48, 60, 72, 84]
  const poleGeos: THREE.BufferGeometry[] = []
  const cableGeos: THREE.BufferGeometry[] = []
  const POLE_Z = -2.55
  for (const x of poleXs) {
    const pole = new THREE.CylinderGeometry(0.11, 0.17, 10.6, 8)
    pole.translate(x, 5.3, POLE_Z)
    poleGeos.push(pole)
    const arm = new THREE.BoxGeometry(0.14, 0.14, 2.2)
    arm.translate(x, 10.1, POLE_Z)
    poleGeos.push(arm)
    for (const dz of [-0.9, -0.3, 0.3, 0.9]) {
      const ins = new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6)
      ins.translate(x, 10.28, POLE_Z + dz)
      poleGeos.push(ins)
    }
    // Transformador en algunos postes
    if (x === 24 || x === -34) {
      const tr = new THREE.CylinderGeometry(0.34, 0.34, 0.9, 10)
      tr.translate(x + 0.4, 8.6, POLE_Z)
      poleGeos.push(tr)
    }
  }
  const cable = (a: THREE.Vector3, b: THREE.Vector3, sag: number, r: number) => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 18; i += 1) {
      const t = i / 18
      const p = a.clone().lerp(b, t)
      p.y -= sag * 4 * t * (1 - t)
      pts.push(p)
    }
    cableGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 4, false))
  }
  for (let i = 0; i < poleXs.length - 1; i += 1) {
    const a = poleXs[i]
    const b = poleXs[i + 1]
    ;[-0.9, -0.3, 0.3, 0.9].forEach((dz, k) => {
      cable(new THREE.Vector3(a, 10.32, POLE_Z + dz), new THREE.Vector3(b, 10.32, POLE_Z + dz), 0.7 + k * 0.12 + rand() * 0.2, 0.018)
    })
    // Cables de telecomunicaciones más bajos y enredados (lejos de las ventanas de la historia)
    if (a > 0) {
      for (let k = 0; k < 3; k += 1) cable(new THREE.Vector3(a, 7.9 - k * 0.12, POLE_Z + 0.15), new THREE.Vector3(b, 7.9 - k * 0.1, POLE_Z + 0.15), 0.35 + rand() * 0.3, 0.03)
    }
  }
  const poleMesh = new THREE.Mesh(mergeGeometries(poleGeos), new THREE.MeshStandardMaterial({ color: '#8e8b85', roughness: 0.85 }))
  poleMesh.castShadow = true
  scene.add(poleMesh)
  scene.add(new THREE.Mesh(mergeGeometries(cableGeos), new THREE.MeshStandardMaterial({ color: '#0b0c0f', roughness: 0.5 })))

  // --- Faroles -------------------------------------------------------------------
  const glow = glowTexture()
  const lampXs = [-27, -14.5, 14.5, 27, 40.5, 54, 67.5, 81]
  const lampGeos: THREE.BufferGeometry[] = []
  const lampHeads: THREE.Vector3[] = []
  const LAMP_Z = 4.7
  for (const x of lampXs) {
    const pole = new THREE.CylinderGeometry(0.07, 0.11, 6.2, 8)
    pole.translate(x, 3.1, LAMP_Z)
    lampGeos.push(pole)
    const arm = new THREE.TubeGeometry(
      new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, 6.1, LAMP_Z), new THREE.Vector3(x, 6.75, LAMP_Z - 0.5), new THREE.Vector3(x, 6.5, LAMP_Z - 1.5)),
      10,
      0.05,
      5,
      false,
    )
    lampGeos.push(arm)
    const head = new THREE.BoxGeometry(0.42, 0.12, 0.8)
    head.translate(x, 6.44, LAMP_Z - 1.6)
    lampGeos.push(head)
    lampHeads.push(new THREE.Vector3(x, 6.34, LAMP_Z - 1.6))
  }
  scene.add(new THREE.Mesh(mergeGeometries(lampGeos), new THREE.MeshStandardMaterial({ color: '#23262c', roughness: 0.45, metalness: 0.6 })))

  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(3) })
  const bulbs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 0.03, 0.62), bulbMat, lampHeads.length)
  lampHeads.forEach((p, i) => bulbs.setMatrixAt(i, place(p.x, p.y, p.z, 1)))
  bulbs.instanceMatrix.needsUpdate = true
  scene.add(bulbs)

  // Halo, cono de luz y charco de luz en el suelo
  const halos: THREE.Sprite[] = []
  const coneUniforms = { uLevel: { value: 1 }, uColor: { value: new THREE.Color('#ffc480') } }
  const coneMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: coneUniforms,
    vertexShader: /* glsl */ `
      varying float vH; varying vec3 vN; varying vec3 vView;
      void main() {
        vH = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uLevel; uniform vec3 uColor;
      varying float vH; varying vec3 vN; varying vec3 vView;
      void main() {
        float edge = pow(abs(dot(vN, vView)), 1.6);
        float a = edge * pow(vH, 1.4) * 0.11 * uLevel;
        gl_FragColor = vec4(uColor * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const poolMat = new THREE.MeshBasicMaterial({ map: glow, color: '#ffb766', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 })
  const coneGeo = new THREE.CylinderGeometry(0.18, 2.6, 6.3, 24, 1, true)
  coneGeo.translate(0, -3.15, 0)
  for (const p of lampHeads) {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffbf75', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }))
    halo.scale.set(2.6, 2.6, 1)
    halo.position.copy(p).add(new THREE.Vector3(0, -0.1, 0))
    scene.add(halo)
    halos.push(halo)
    if (!opts.lite) {
      const cone = new THREE.Mesh(coneGeo, coneMat)
      cone.position.copy(p)
      scene.add(cone)
    }
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), poolMat)
    pool.rotation.x = -Math.PI / 2
    pool.position.set(p.x, 0.17, p.z + 0.2)
    scene.add(pool)
    emitters.push({ pos: p.clone(), color: new THREE.Color('#ffc27a'), size: 1.4, level: () => lightLevel.lamps })
  }
  // Solo dos faroles iluminan de verdad (cerca de la cuadra): el resto es halo y reflejo.
  const lampLights = [1, 2].map((i) => {
    const l = new THREE.PointLight('#ffb25a', 14, 20, 1.8)
    l.position.copy(lampHeads[i]).add(new THREE.Vector3(0, -0.4, 0))
    scene.add(l)
    return l
  })

  // --- Plátanos orientales --------------------------------------------------------
  const treeSpots = [
    [-16.2, -3.3],
    [-29, -3.3],
    [12.1, -3.4],
    [-44, -3.3],
    [88, -3.3],
  ] as const
  const bark = barkTexture()
  const trunkGeos: THREE.BufferGeometry[] = []
  const leafMatrices: THREE.Matrix4[] = []
  for (const [tx, tz] of treeSpots) {
    const trunk = new THREE.CylinderGeometry(0.22, 0.34, 5.4, 9)
    trunk.translate(tx, 2.7, tz)
    trunkGeos.push(trunk)
    for (let k = 0; k < 4; k += 1) {
      const a = (k / 4) * Math.PI * 2 + rand()
      const len = 2.2 + rand()
      const br = new THREE.CylinderGeometry(0.07, 0.14, len, 6)
      br.translate(0, len / 2, 0)
      br.rotateZ(Math.cos(a) * 0.7)
      br.rotateX(Math.sin(a) * 0.7)
      br.translate(tx, 5.1, tz)
      trunkGeos.push(br)
    }
    const count = opts.lite ? 160 : 300
    for (let i = 0; i < count; i += 1) {
      const th = rand() * Math.PI * 2
      const ph = Math.acos(2 * rand() - 1)
      const r = Math.cbrt(rand())
      dummy.position.set(tx + Math.sin(ph) * Math.cos(th) * 3.2 * r, 7.6 + Math.cos(ph) * 2.3 * r, tz + Math.sin(ph) * Math.sin(th) * 2.6 * r)
      dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI)
      const s = 1.1 + rand() * 0.9
      dummy.scale.set(s, s, s)
      dummy.updateMatrix()
      leafMatrices.push(dummy.matrix.clone())
    }
  }
  const trunks = new THREE.Mesh(mergeGeometries(trunkGeos), new THREE.MeshStandardMaterial({ map: bark, roughness: 0.9 }))
  trunks.castShadow = true
  scene.add(trunks)
  const leafMat = new THREE.MeshStandardMaterial({ map: leafClusterTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, color: '#9fb88a' })
  const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.4, 1.4), leafMat, leafMatrices.length)
  leafMatrices.forEach((m, i) => leaves.setMatrixAt(i, m))
  leaves.instanceMatrix.needsUpdate = true
  leaves.castShadow = true
  scene.add(leaves)

  // --- Autos estacionados -----------------------------------------------------------
  const carProfile = new THREE.Shape()
  carProfile.moveTo(-2.15, 0.28)
  carProfile.lineTo(2.1, 0.28)
  carProfile.quadraticCurveTo(2.25, 0.3, 2.22, 0.62)
  carProfile.quadraticCurveTo(2.15, 0.82, 1.4, 0.86)
  carProfile.quadraticCurveTo(0.9, 1.34, 0.2, 1.36)
  carProfile.lineTo(-0.9, 1.34)
  carProfile.quadraticCurveTo(-1.55, 1.3, -1.85, 0.9)
  carProfile.quadraticCurveTo(-2.2, 0.82, -2.2, 0.5)
  carProfile.closePath()
  const carBody = new THREE.ExtrudeGeometry(carProfile, { depth: 1.7, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 })
  carBody.translate(0, 0, -0.85)
  const glassShape = new THREE.Shape()
  glassShape.moveTo(1.28, 0.9)
  glassShape.quadraticCurveTo(0.85, 1.28, 0.2, 1.3)
  glassShape.lineTo(-0.85, 1.28)
  glassShape.quadraticCurveTo(-1.4, 1.24, -1.66, 0.92)
  glassShape.closePath()
  const carGlass = new THREE.ExtrudeGeometry(glassShape, { depth: 1.76, bevelEnabled: false })
  carGlass.translate(0, 0, -0.88)
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16)
  wheelGeo.rotateX(Math.PI / 2)
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#121214', roughness: 0.8 })
  const glassMat = new THREE.MeshStandardMaterial({ color: '#0d1117', roughness: 0.08, metalness: 0.9, envMapIntensity: 1.4 })
  const tailMat = new THREE.MeshBasicMaterial({ color: '#5a0f0f' })
  const cars: [number, number, string, number][] = [
    [-12.9, -1.25, '#6b1a1f', 1],
    [9.9, -1.3, '#d9d8d4', -1],
    [31, -1.3, '#8f959c', 1],
    [57.5, -1.25, '#1e3557', -1],
  ]
  for (const [x, z, color, dir] of cars) {
    const car = new THREE.Group()
    const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.55, envMapIntensity: 1.3 })
    const body = new THREE.Mesh(carBody, paint)
    body.castShadow = true
    car.add(body, new THREE.Mesh(carGlass, glassMat))
    for (const [wx, wz] of [
      [1.35, 0.8],
      [-1.35, 0.8],
      [1.35, -0.8],
      [-1.35, -0.8],
    ]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat)
      w.position.set(wx, 0.34, wz)
      car.add(w)
    }
    for (const tz of [-0.6, 0.6]) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.32), tailMat)
      tail.position.set(-2.2, 0.7, tz)
      car.add(tail)
    }
    car.position.set(x, 0, z)
    car.rotation.y = dir === 1 ? 0 : Math.PI
    scene.add(car)
  }

  // --- Neblina baja -----------------------------------------------------------------
  const mistUniforms = { uTime: { value: 0 }, uLevel: { value: 1 }, uColor: { value: new THREE.Color('#8fa0c8') } }
  const mistMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: mistUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uLevel; uniform vec3 uColor;
      varying vec2 vUv; varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main() {
        vec2 p = vec2(vWorld.x * 0.08 + uTime * 0.03, vWorld.y * 0.35);
        float n = fbm(p + vec2(0.0, uTime * 0.01));
        float fade = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y));
        float a = n * fade * 0.22 * uLevel;
        gl_FragColor = vec4(uColor, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const mists: THREE.Mesh[] = []
  for (const z of [-1.2, 2.6]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(320, 3.4), mistMat)
    m.position.set(20, 1.5, z)
    scene.add(m)
    mists.push(m)
  }

  return {
    emitters,
    halos,
    update(L: Light, t: number) {
      lightLevel.lamps = L.lamps
      lightLevel.windows = L.windows
      lightLevel.wet = L.wet
      // De día la calle está seca: sin charcos brillantes
      const wet = L.wet > 0.12
      if (wet !== wetRoad) {
        wetRoad = wet
        roadMat.roughnessMap = wet ? rough : null
        roadMat.roughness = wet ? 1 : 0.92
        roadMat.needsUpdate = true
      }
      lightLevel.mist = L.mist
      bulbMat.color.set('#ffd9a0').multiplyScalar(0.25 + 2.8 * L.lamps)
      halos.forEach((h, i) => (h.material.opacity = 0.6 * L.lamps * (0.95 + 0.05 * Math.sin(t * 2.1 + i))))
      halos.forEach((h) => (h.visible = L.lamps > 0.02))
      coneUniforms.uLevel.value = L.lamps
      poolMat.opacity = 0.5 * L.lamps
      lampLights.forEach((l) => (l.intensity = 14 * L.lamps))
      litMat.color.setScalar(0.25 + 1.0 * L.windows)
      mistUniforms.uTime.value = t
      mistUniforms.uLevel.value = L.mist
      mistUniforms.uColor.value.copy(L.fog).lerp(new THREE.Color('#c9d3ea'), 0.35)
      mists.forEach((m) => (m.visible = L.mist > 0.02))
      // De día las hojas se ven verdes; de noche, siluetas.
      leafMat.color.set('#9fb88a')
    },
  }
}
