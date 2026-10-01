import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Emitter } from './city'
import { FRONT_Z, worldBox } from './city'
import type { Light } from './palette'
import {
  awningTexture,
  closedTexture,
  facadeTexture,
  leafClusterTexture,
  mulberry32,
  salonWallTexture,
  signTexture,
  tabletTexture,
  tileFloorTexture,
} from './textures'

/**
 * «Uñas Bella», el local de la historia: fachada, vitrina con frascos, el
 * letrero de CERRADO y, adentro, el salón (pared de esmaltes, espejo con aro
 * de luz, mesa de manicura). Sobre la mesa, una tablet: es lo que se enciende
 * cuando ZeroVisto responde con el local cerrado.
 */
export function createShop(scene: THREE.Scene) {
  const group = new THREE.Group()
  group.position.set(0, 0, FRONT_Z)
  scene.add(group)
  const rand = mulberry32(2024)

  // --- Cascarón con la vitrina abierta -----------------------------------------
  const W = 7
  const H = 6.4
  const ROOM = { x0: -3.3, x1: 3.3, y1: 4.2, z0: -1.6, z1: 3.4 }
  const shell: THREE.BufferGeometry[] = []
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const g = worldBox(w, h, d)
    g.translate(x, y, z)
    shell.push(g)
  }
  box(W, H, 1.9, 0, H / 2, -2.55) // fondo
  box(0.2, H, 5.1, -3.4, H / 2, 0.95) // muros laterales
  box(0.2, H, 5.1, 3.4, H / 2, 0.95)
  box(W, H - ROOM.y1, 5.1, 0, ROOM.y1 + (H - ROOM.y1) / 2, 0.95) // losa sobre el salón
  box(W, 0.72, 0.2, 0, 0.36, 3.4) // zócalo bajo la vitrina
  box(0.75, 2.9, 0.2, -3.125, 0.72 + 1.45, 3.4) // pilares
  box(0.75, 2.9, 0.2, 3.125, 0.72 + 1.45, 3.4)
  box(W, 0.58, 0.2, 0, 3.62 + 0.29, 3.4) // dintel
  const shellMesh = new THREE.Mesh(
    mergeGeometries(shell),
    new THREE.MeshStandardMaterial({ map: facadeTexture(), color: '#8a6f78', roughness: 0.9 }),
  )
  shellMesh.castShadow = true
  shellMesh.receiveShadow = true
  group.add(shellMesh)

  // --- Interior -------------------------------------------------------------------
  const floorTex = tileFloorTexture()
  floorTex.repeat.set(3, 2.4)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 5), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.35, metalness: 0.05 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0.02, 0.9)
  group.add(floor)
  const wallMat = new THREE.MeshStandardMaterial({ map: salonWallTexture(), roughness: 0.9 })
  const back = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 4.2), wallMat)
  back.position.set(0, 2.1, ROOM.z0 + 0.02)
  group.add(back)
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(5, 4.2), wallMat)
    wall.rotation.y = -side * Math.PI / 2
    wall.position.set(side * 3.28, 2.1, 0.9)
    group.add(wall)
  }
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 5), new THREE.MeshStandardMaterial({ color: '#efe6df', roughness: 0.95 }))
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.set(0, 4.18, 0.9)
  group.add(ceiling)

  // Pared de esmaltes: repisas con más de cien frascos
  const rackGeos: THREE.BufferGeometry[] = []
  for (let r = 0; r < 6; r += 1) {
    const sh = new THREE.BoxGeometry(3.4, 0.04, 0.16)
    sh.translate(0.9, 1.7 + r * 0.32, ROOM.z0 + 0.1)
    rackGeos.push(sh)
  }
  group.add(new THREE.Mesh(mergeGeometries(rackGeos), new THREE.MeshStandardMaterial({ color: '#f4efe9', roughness: 0.6 })))
  const polishColors = ['#c0263a', '#e85a71', '#f2a0b0', '#8c1c3b', '#ffcfb0', '#e0b04a', '#7a3fa0', '#3d5fb8', '#2b9a8a', '#f4f0e6', '#1c1c22', '#ff7a45']
  const bottleGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.13, 8)
  const wall = new THREE.InstancedMesh(bottleGeo, new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.1 }), 6 * 24)
  const d = new THREE.Object3D()
  const col = new THREE.Color()
  let n = 0
  for (let r = 0; r < 6; r += 1) {
    for (let c = 0; c < 24; c += 1) {
      d.position.set(-0.7 + c * 0.138, 1.79 + r * 0.32, ROOM.z0 + 0.12)
      d.updateMatrix()
      wall.setMatrixAt(n, d.matrix)
      wall.setColorAt(n, col.set(polishColors[Math.floor(rand() * polishColors.length)]))
      n += 1
    }
  }
  wall.instanceMatrix.needsUpdate = true
  if (wall.instanceColor) wall.instanceColor.needsUpdate = true
  group.add(wall)

  // Espejo redondo con aro de luz
  const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.52, 40), new THREE.MeshStandardMaterial({ color: '#cfd6e0', roughness: 0.05, metalness: 1, envMapIntensity: 1.3 }))
  mirror.position.set(-2.1, 2.45, ROOM.z0 + 0.04)
  group.add(mirror)
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1dc').multiplyScalar(2) })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 10, 48), ringMat)
  ring.position.copy(mirror.position).add(new THREE.Vector3(0, 0, 0.02))
  group.add(ring)

  // Mesa de manicura, sillas, lámpara de escritorio y una planta
  const wood = new THREE.MeshStandardMaterial({ color: '#efe9e2', roughness: 0.45 })
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2328', roughness: 0.7 })
  const table = new THREE.Group()
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.85), wood)
  top.position.y = 0.95
  table.add(top)
  for (const [x, z] of [
    [-0.85, -0.35],
    [0.85, -0.35],
    [-0.85, 0.35],
    [0.85, 0.35],
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.92, 0.05), dark)
    leg.position.set(x, 0.46, z)
    table.add(leg)
  }
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.2), new THREE.MeshStandardMaterial({ color: '#d98fa0', roughness: 0.9 }))
  cushion.position.set(-0.3, 1.02, 0.15)
  table.add(cushion)
  // La tablet: la pantalla donde se ve al agente responder
  const tabletMat = new THREE.MeshBasicMaterial({ map: tabletTexture(), color: new THREE.Color(0.25, 0.25, 0.25) })
  const tablet = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.46), tabletMat)
  tablet.position.set(0.45, 1.24, 0.05)
  tablet.rotation.x = -0.32
  table.add(tablet)
  const tabletBack = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.49, 0.02), dark)
  tabletBack.position.set(0.45, 1.24, 0.035)
  tabletBack.rotation.x = -0.32
  table.add(tabletBack)
  // Lámpara de escritorio
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.03, 16), dark)
  lampBase.position.set(-0.75, 0.99, -0.25)
  const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 6), dark)
  lampArm.position.set(-0.68, 1.25, -0.2)
  lampArm.rotation.z = -0.3
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4e0').multiplyScalar(1.5) })
  const lampHead = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.14, 16, 1, true), lampHeadMat)
  lampHead.position.set(-0.56, 1.5, -0.12)
  lampHead.rotation.z = 0.9
  table.add(lampBase, lampArm, lampHead)
  table.position.set(0.3, 0, 0.7)
  group.add(table)
  const chair = (x: number, z: number, rot: number) => {
    const c = new THREE.Group()
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.55), new THREE.MeshStandardMaterial({ color: '#b97a8a', roughness: 0.8 }))
    seat.position.y = 0.5
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.07), new THREE.MeshStandardMaterial({ color: '#b97a8a', roughness: 0.8 }))
    backrest.position.set(0, 0.82, -0.25)
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), dark)
    leg.position.y = 0.25
    c.add(seat, backrest, leg)
    c.position.set(x, 0, z)
    c.rotation.y = rot
    group.add(c)
  }
  chair(0.3, 1.75, Math.PI)
  chair(0.3, -0.25, 0)
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.42, 14), new THREE.MeshStandardMaterial({ color: '#c8b8a6', roughness: 0.8 }))
  pot.position.set(2.6, 0.21, 2.4)
  group.add(pot)
  const plantMat = new THREE.MeshStandardMaterial({ map: leafClusterTexture(), alphaTest: 0.45, side: THREE.DoubleSide, color: '#7fa86a' })
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), plantMat)
    leaf.position.set(2.6 + (rand() - 0.5) * 0.3, 0.75 + rand() * 0.45, 2.4 + (rand() - 0.5) * 0.3)
    leaf.rotation.set(rand() * 3, rand() * 3, rand() * 3)
    group.add(leaf)
  }
  // Lámparas colgantes
  const pendantMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2b8').multiplyScalar(2) })
  for (const x of [-1.4, 1.4]) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.7, 4), dark)
    cord.position.set(x, 3.85, 1.2)
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), pendantMat)
    bulb.position.set(x, 3.45, 1.2)
    group.add(cord, bulb)
  }
  const interior = new THREE.PointLight('#ffcf9a', 6, 9, 1.6)
  interior.position.set(0, 3.2, 1.2)
  group.add(interior)

  // --- Vitrina -------------------------------------------------------------------
  const frameMat = new THREE.MeshStandardMaterial({ color: '#141014', roughness: 0.5, metalness: 0.5 })
  const frameParts: [number, number, number, number][] = [
    [5.5, 0.1, 0, 3.62],
    [5.5, 0.1, 0, 0.72],
    [0.08, 2.9, -1.0, 2.17],
    [0.08, 2.9, 1.0, 2.17],
  ]
  for (const [w, h, x, y] of frameParts) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), frameMat)
    f.position.set(x, y, 3.42)
    group.add(f)
  }
  // Repisas de vidrio con frascos de muestra. Los dos del centro de abajo son los que se venden.
  const shelfMat = new THREE.MeshStandardMaterial({ color: '#dfe7ee', transparent: true, opacity: 0.45, roughness: 0.05 })
  for (const y of [1.66, 2.5]) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.03, 0.42), shelfMat)
    sh.position.set(0, y, 3.12)
    group.add(sh)
  }
  const showColors = ['#e04b3a', '#f6d3b8', '#7a2f5a', '#f2a65a', '#d9d2c3', '#b83b52', '#ffb347']
  const soldBottles: { meshes: THREE.Mesh[]; y: number }[] = []
  for (let i = 0; i < 14; i += 1) {
    const bx = -2.1 + (i % 7) * 0.7
    const by = i < 7 ? 1.84 : 2.68
    const sold = i === 3 || i === 4
    const bodyMat = new THREE.MeshStandardMaterial({
      color: sold ? '#e04b3a' : showColors[(i * 3) % showColors.length],
      roughness: 0.18,
      metalness: 0.05,
      transparent: sold,
      envMapIntensity: 1.2,
    })
    const capMat = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.4, transparent: sold })
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.32, 14), bodyMat)
    bottle.position.set(bx, by, 3.12)
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10), capMat)
    cap.position.set(bx, by + 0.24, 3.12)
    group.add(bottle, cap)
    if (sold) soldBottles.push({ meshes: [bottle, cap], y: by })
  }
  // Letrero de «CERRADO» colgando detrás del vidrio
  const closed = new THREE.Group()
  closed.add(new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.54), new THREE.MeshStandardMaterial({ map: closedTexture(), roughness: 0.7, emissive: '#3a2a20', emissiveIntensity: 0.4 })))
  for (const x of [-0.3, 0.3]) {
    const cord = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.5, 0.01), frameMat)
    cord.position.set(x, 0.42, 0)
    cord.rotation.z = x > 0 ? -0.5 : 0.5
    closed.add(cord)
  }
  closed.position.set(0, 3.05, 3.3)
  group.add(closed)
  // Vidrio: casi invisible, solo el reflejo del cielo y las luces
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 2.9),
    new THREE.MeshStandardMaterial({ color: '#9fb2cc', transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0.4, envMapIntensity: 1.6, depthWrite: false }),
  )
  glass.position.set(0, 2.17, 3.36)
  glass.renderOrder = 2
  group.add(glass)

  // Letrero luminoso y toldo
  const style = { text: 'UÑAS BELLA', sub: 'manicura · esmaltado', kind: 'lightbox' as const, bg: '#1b1214', fg: '#ffd9a0', font: 'serif' as const }
  const signOn = signTexture(style, true)
  const signOff = signTexture(style, false)
  const signMat = new THREE.MeshBasicMaterial({ map: signOn, color: new THREE.Color(1.4, 1.3, 1.15) })
  const sign = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.15, 0.16), [frameMat, frameMat, frameMat, frameMat, signMat, frameMat])
  sign.position.set(0, 4.82, 3.62)
  group.add(sign)
  const awning = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 1.25), new THREE.MeshStandardMaterial({ map: awningTexture('#e7c9c9', '#9c3d55'), side: THREE.DoubleSide, roughness: 0.85 }))
  awning.position.set(0, 4.02, 4.1)
  awning.rotation.x = -Math.PI / 2 + 0.42
  awning.castShadow = true
  group.add(awning)

  const emitters: Emitter[] = [
    { pos: new THREE.Vector3(0, 2.2, FRONT_Z + 3.5), color: new THREE.Color('#ffcf94'), size: 4.2, level: () => level.shop },
    { pos: new THREE.Vector3(0, 4.82, FRONT_Z + 3.7), color: new THREE.Color('#ffd9a0'), size: 3.4, level: () => level.sign },
  ]
  const level = { shop: 0.3, sign: 1 }

  return {
    group,
    emitters,
    /** Punto donde llegan y salen los mensajes. */
    door: new THREE.Vector3(0, 2.3, FRONT_Z + 3.8),
    update(L: Light, shopLevel: number, sold: number, t: number) {
      level.shop = shopLevel
      level.sign = Math.max(L.lamps, 0.2)
      const awake = shopLevel > 0.6 ? 0.05 * Math.sin(t * 2.4) : 0
      interior.intensity = 1.5 + shopLevel * 9
      pendantMat.color.set('#ffe2b8').multiplyScalar(0.25 + shopLevel * 1.9)
      ringMat.color.set('#fff1dc').multiplyScalar(0.3 + shopLevel * 1.8)
      lampHeadMat.color.set('#fff4e0').multiplyScalar(0.3 + shopLevel * 1.4)
      // La tablet: apagada cuando el local está cerrado; se ilumina mientras el agente responde
      tabletMat.color.setScalar(0.12 + shopLevel * 1.15 + awake)
      signMat.map = L.lamps > 0.15 ? signOn : signOff
      signMat.color.setScalar(L.lamps > 0.15 ? 0.9 + L.lamps * 0.6 : 1)
      soldBottles.forEach((b, i) => {
        const s = Math.min(1, Math.max(0, sold - i))
        b.meshes.forEach((m, j) => {
          ;(m.material as THREE.MeshStandardMaterial).opacity = 1 - s
          m.position.y = b.y + (j === 1 ? 0.24 : 0) + s * 0.5
          m.visible = s < 0.99
        })
      })
    },
  }
}
