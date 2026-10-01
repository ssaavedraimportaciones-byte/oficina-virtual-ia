import * as THREE from 'three'
import { FLIGHTS, type Place } from '../data'
import { ANA, FACE_Z, OWNER, type Emitter } from './city'
import { glowTexture, roomTexture, silhouetteTexture } from './textures'

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

/**
 * Las dos ventanas de la historia (Ana y Caro) y los mensajes que viajan entre
 * ellas y el local, como luces con estela.
 */
export function createStory(scene: THREE.Scene, shopDoor: THREE.Vector3) {
  const glow = glowTexture()
  const frameMat = new THREE.MeshStandardMaterial({ color: '#0d0f16', roughness: 0.6 })

  const storyWindow = (at: THREE.Vector3, pose: 'phone' | 'standing', warm: string, deep: string) => {
    const group = new THREE.Group()
    group.position.copy(at)
    const room = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9), new THREE.MeshBasicMaterial({ map: roomTexture(warm, deep), color: new THREE.Color(1.15, 1.08, 1) }))
    const person = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.38), new THREE.MeshBasicMaterial({ map: silhouetteTexture(pose), transparent: true }))
    person.position.set(pose === 'phone' ? -0.1 : 0.15, -0.26, 0.01)
    const bars: [number, number, number, number][] = [
      [1.74, 0.12, 0, 1.0],
      [1.9, 0.16, 0, -1.02],
      [0.12, 2.12, -0.81, 0],
      [0.12, 2.12, 0.81, 0],
      [0.06, 1.9, 0, 0],
    ]
    for (const [w, h, x, y] of bars) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), frameMat)
      b.position.set(x, y, 0.06)
      group.add(b)
    }
    const phone = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#b9dcff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
    phone.position.set(pose === 'phone' ? 0.24 : -0.45, pose === 'phone' ? -0.25 : -0.62, 0.06)
    phone.scale.set(0.9, 0.9, 1)
    const spill = new THREE.PointLight(warm, 0, 9, 1.8)
    spill.position.set(0, 0, 1.2)
    // Resalte al pasar el mouse
    const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: warm, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
    rim.scale.set(4.2, 4.6, 1)
    rim.position.set(0, 0, 0.2)
    group.add(room, person, phone, spill, rim)
    scene.add(group)
    return { group, room, person, phone, spill, rim, hover: 0 }
  }
  const ana = storyWindow(ANA, 'phone', '#ffcf8a', '#b8662c')
  const owner = storyWindow(OWNER, 'standing', '#ffd59a', '#c07434')

  // Mensajes en vuelo: una luz con estela que sigue un arco entre dos lugares
  const PLACES: Record<Place, THREE.Vector3> = {
    ana: ANA.clone().add(new THREE.Vector3(0.2, -0.2, 0.3)),
    shop: shopDoor.clone(),
    owner: OWNER.clone().add(new THREE.Vector3(0, -0.2, 0.3)),
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

  /** Puntos donde se anclan los rótulos del DOM. */
  const labels: Record<string, THREE.Vector3> = {
    ana: ANA.clone().add(new THREE.Vector3(0, -1.2, 0)),
    shop: new THREE.Vector3(0, 5.55, FACE_Z),
    owner: OWNER.clone().add(new THREE.Vector3(0, -1.2, 0)),
    shelf: new THREE.Vector3(0, 1.58, FACE_Z),
  }

  // Zonas que reaccionan al mouse (invisibles)
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false })
  const proxies: THREE.Mesh[] = []
  const proxy = (name: string, w: number, h: number, at: THREE.Vector3) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), proxyMat)
    m.position.copy(at).add(new THREE.Vector3(0, 0, 0.3))
    m.name = name
    scene.add(m)
    proxies.push(m)
  }
  proxy('ana', 2.4, 2.8, ANA)
  proxy('owner', 2.4, 2.8, OWNER)
  proxy('shop', 7, 5.6, new THREE.Vector3(0, 2.8, FACE_Z))

  const emitters: Emitter[] = [
    { pos: ANA.clone(), color: new THREE.Color('#ffc983'), size: 2.2, level: () => 0.8 },
    { pos: OWNER.clone(), color: new THREE.Color('#ffd59a'), size: 2.2, level: () => lv.owner },
  ]
  const lv = { owner: 1 }

  return {
    flights,
    labels,
    proxies,
    emitters,
    update(state: { owner: number; ownerPhone: number; anaPhone: number; fl: Record<string, number> }, t: number, hovered: string) {
      ana.hover += ((hovered === 'ana' ? 1 : 0) - ana.hover) * 0.15
      owner.hover += ((hovered === 'owner' ? 1 : 0) - owner.hover) * 0.15
      ana.spill.intensity = 3 + ana.hover * 4
      ana.phone.material.opacity = clamp01(state.anaPhone) * (0.85 + 0.15 * Math.sin(t * 3))
      ana.rim.material.opacity = ana.hover * 0.35
      const o = clamp01(state.owner)
      lv.owner = 0.15 + o * 0.85
      ;(owner.room.material as THREE.MeshBasicMaterial).color.setScalar(0.06 + o * 1.05 + owner.hover * 0.3)
      ;(owner.person.material as THREE.MeshBasicMaterial).opacity = 0.25 + o * 0.75
      owner.spill.intensity = o * 3 + owner.hover * 3
      owner.rim.material.opacity = owner.hover * 0.35
      const ping = clamp01(state.ownerPhone)
      owner.phone.material.opacity = ping * (0.75 + 0.25 * Math.sin(t * 7))
      owner.phone.scale.setScalar(0.9 + ping * 0.6)

      for (const f of flights) {
        const p = state.fl[f.id] ?? 0
        const flying = p > 0.001 && p < 0.999
        f.sprites.forEach((s, k) => {
          const tk = clamp01(p - k * 0.03)
          s.visible = flying && tk > 0
          if (!s.visible) return
          f.curve.getPoint(tk, s.position)
          s.material.opacity = (k === 0 ? 1 : 0.7 * (1 - k / TRAIL)) * smooth(0, 0.08, p) * (1 - smooth(0.94, 1, p))
        })
      }
    },
  }
}
