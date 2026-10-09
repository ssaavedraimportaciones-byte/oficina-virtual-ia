import * as THREE from 'three'
import { CLINIC_BLOCK, FACE_Z, ROJAS } from './city'
import { bubbleTexture, personTexture } from './foodtruck'
import type { Light } from './palette'
import { canvasTexture, glowTexture, roomTexture, silhouetteTexture } from './textures'

/**
 * La urgencia dental: Clínica Sonrisa, cerrada a las diez de la noche, en el
 * primer piso del edificio que sigue a la calle de rubros. Adentro está oscuro,
 * pero la pantalla de la agenda sigue viva (es el agente). Camila llega con
 * dolor, encuentra la puerta cerrada y escribe desde la vereda; cada mensaje
 * viaja entre su teléfono y la clínica, como Nico con el carro. Cuando queda
 * agendada, el agente le avisa al Dr. Rojas (se enciende su ventana, arriba) y
 * Camila se va tranquila.
 *
 * Igual que el carro de completos, todo sale del segundo de la conversación
 * (bus.dental), así el chat de la página y la escena cuentan lo mismo, hacia
 * adelante o hacia atrás.
 */

type Agenda = 'idle' | 'urgent' | 'offer' | 'booked' | 'notified'

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export function createDental(scene: THREE.Scene) {
  const group = new THREE.Group()
  scene.add(group)
  const glow = glowTexture()
  const cx = CLINIC_BLOCK.x
  const front = FACE_Z - 0.03 // cara del edificio

  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    group.add(m)
    return m
  }
  const lit: { mat: THREE.MeshBasicMaterial; base: number }[] = []
  const emissive = (w: number, h: number, map: THREE.Texture, base: number, x: number, y: number, z: number) => {
    const mat = new THREE.MeshBasicMaterial({ map, color: new THREE.Color(0, 0, 0) })
    lit.push({ mat, base })
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
    m.position.set(x, y, z)
    group.add(m)
    return mat
  }

  // --- Fachada de la clínica (primer piso) -------------------------------------
  const wallMat = new THREE.MeshStandardMaterial({ color: '#d6e1dd', roughness: 0.72 })
  const trimMat = new THREE.MeshStandardMaterial({ color: '#1d5e63', roughness: 0.45, metalness: 0.25 })
  const glassMat = new THREE.MeshStandardMaterial({ color: '#0a0f17', roughness: 0.06, metalness: 0.9, envMapIntensity: 1.5 })
  box(8.6, 4.1, 0.18, cx, 2.05, front + 0.09, wallMat)
  box(8.7, 0.35, 0.26, cx, 0.175, front + 0.13, trimMat)
  // Letrero
  box(7.6, 1.08, 0.22, cx, 3.45, front + 0.2, trimMat)
  const signMat = emissive(7.4, 0.94, signTexture(), 1.05, cx, 3.45, front + 0.32)
  // Vitrina de la recepción, a oscuras
  const winX = cx - 2.15
  box(3.95, 2.4, 0.2, winX, 1.55, front + 0.19, trimMat)
  emissive(3.75, 2.2, receptionTexture(), 0.32, winX, 1.55, front + 0.3)
  const glassFront = new THREE.Mesh(new THREE.PlaneGeometry(3.75, 2.2), new THREE.MeshStandardMaterial({ color: '#9fb6c8', roughness: 0.05, metalness: 1, transparent: true, opacity: 0.12, envMapIntensity: 2 }))
  glassFront.position.set(winX, 1.55, front + 0.36)
  group.add(glassFront)
  // La pantalla de la agenda: lo único vivo adentro
  const agendaTex: Record<Agenda, THREE.Texture> = {
    idle: agendaTexture('idle'),
    urgent: agendaTexture('urgent'),
    offer: agendaTexture('offer'),
    booked: agendaTexture('booked'),
    notified: agendaTexture('notified'),
  }
  const monX = winX + 0.2
  const monitorMat = new THREE.MeshBasicMaterial({ map: agendaTex.idle, color: new THREE.Color(1, 1, 1) })
  const monitor = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.81), monitorMat)
  monitor.position.set(monX, 1.55, front + 0.33)
  group.add(monitor)
  let agenda: Agenda = 'idle'
  const screenGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#8fd0ff', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }))
  screenGlow.position.set(monX, 1.55, front + 0.55)
  screenGlow.scale.set(4.6, 3, 1)
  group.add(screenGlow)
  // Puerta con el «CERRADO»
  const doorX = cx + 2.6
  box(1.55, 2.8, 0.2, doorX, 1.4, front + 0.19, trimMat)
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.58), glassMat)
  door.position.set(doorX, 1.33, front + 0.3)
  group.add(door)
  emissive(1.05, 0.42, closedTexture(), 0.95, doorX, 1.72, front + 0.32)
  // Luz de urgencias (muela con cruz): roja mientras se resuelve, verde cuando queda agendada
  const alertMat = new THREE.MeshBasicMaterial({ map: toothBadgeTexture(), color: new THREE.Color(0.3, 0.3, 0.3), transparent: true })
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), alertMat)
  badge.position.set(cx + 3.82, 2.45, front + 0.33)
  group.add(badge)
  const badgeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ff4d4d', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
  badgeGlow.position.set(cx + 3.82, 2.45, front + 0.5)
  badgeGlow.scale.set(2.2, 2.2, 1)
  group.add(badgeGlow)

  // --- La ventana del Dr. Rojas (el equipo), arriba de la clínica ---------------
  const frameMat = new THREE.MeshStandardMaterial({ color: '#0d0f16', roughness: 0.6 })
  const homeWindow = (at: THREE.Vector3, pose: 'phone' | 'standing', warm: string, deep: string) => {
    const g = new THREE.Group()
    g.position.copy(at)
    const roomMat = new THREE.MeshBasicMaterial({ map: roomTexture(warm, deep), color: new THREE.Color(1, 1, 1) })
    const room = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9), roomMat)
    const personMat = new THREE.MeshBasicMaterial({ map: silhouetteTexture(pose), transparent: true })
    const person = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.38), personMat)
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
      g.add(b)
    }
    const phone = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#b9dcff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
    phone.position.set(pose === 'phone' ? 0.24 : -0.45, pose === 'phone' ? -0.25 : -0.62, 0.08)
    phone.scale.set(0.9, 0.9, 1)
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: warm, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
    halo.scale.set(3.6, 3.9, 1)
    halo.position.set(0, 0, 0.25)
    g.add(room, person, phone, halo)
    group.add(g)
    return { roomMat, personMat, phone, halo }
  }
  const rojas = homeWindow(ROJAS, 'standing', '#cfe3ff', '#4d6b99')

  // --- Camila, la paciente: escribe desde la vereda, frente a la puerta cerrada --
  const PERSON_H = 1.75
  const stand = new THREE.Vector3(cx - 4.8, 0, front + 6.2)
  const leave = stand.clone().add(new THREE.Vector3(3.6, 0, -1.4)) // se va por la vereda, hacia la derecha
  const rim = 'rgba(120, 230, 215, 0.8)' // la luz fría del letrero
  const frames = {
    phone: personTexture('phone', { rim, hair: true }),
    a: personTexture('walkA', { rim, hair: true }),
    b: personTexture('walkB', { rim, hair: true }),
  }
  const camilaMat = new THREE.SpriteMaterial({ map: frames.phone, transparent: true, depthWrite: false })
  const camila = new THREE.Sprite(camilaMat)
  camila.scale.set(PERSON_H * 0.4, PERSON_H, 1)
  camila.position.set(stand.x, PERSON_H / 2, stand.z)
  group.add(camila)
  const phoneOff = new THREE.Vector3(0.2, PERSON_H * 0.66, 0.1)
  const camilaPhoneGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#b9dcff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
  camilaPhoneGlow.scale.set(0.9, 0.9, 1)
  group.add(camilaPhoneGlow)

  // Rótulos pintados junto a cada ventana (solo se ven en este plano)
  const tag = (title: string, sub: string) => new THREE.SpriteMaterial({ map: tagTexture(title, sub), transparent: true, opacity: 0, depthWrite: false, depthTest: false })
  const camilaTagMats = { pain: tag('Camila', 'dolor de muela · 22:10'), calm: tag('Camila', 'agendada 9:30 ✓') }
  const camilaTag = new THREE.Sprite(camilaTagMats.pain)
  camilaTag.scale.set(1.5, 0.41, 1)
  camilaTag.renderOrder = 10
  const rojasTag = new THREE.Sprite(tag('Dr. Rojas', 'el equipo, avisado'))
  rojasTag.position.copy(ROJAS).add(new THREE.Vector3(0, -1.55, 0.4))
  rojasTag.scale.set(2, 0.54, 1)
  rojasTag.renderOrder = 10
  group.add(camilaTag, rojasTag)

  // --- Mensajes en vuelo --------------------------------------------------------
  const monitorAt = new THREE.Vector3(monX, 1.55, front + 0.6)
  const camilaPhone = stand.clone().add(phoneOff)
  const rojasPhone = ROJAS.clone().add(new THREE.Vector3(-0.45, -0.6, 0.35))
  const arc = (a: THREE.Vector3, b: THREE.Vector3, lift: number) =>
    new THREE.QuadraticBezierCurve3(a, a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, lift, 0.8)), b)
  const toClinic = arc(camilaPhone, monitorAt, 1.5)
  const toCamila = arc(monitorAt, camilaPhone, 1.5)
  const toRojas = arc(monitorAt, rojasPhone, 1.8)
  const FLIGHT = 0.75
  const ALERT = 1.15
  const TRAIL = 8
  const trail = Array.from({ length: TRAIL }, (_, k) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
    const size = k === 0 ? 1.1 : 0.7 * (1 - k / TRAIL)
    sp.scale.set(size, size, 1)
    sp.visible = false
    group.add(sp)
    return sp
  })
  const bubbleTex = { contact: bubbleTexture('contact'), agent: bubbleTexture('agent'), alert: envelopeTexture() }
  const bubbleMat = new THREE.SpriteMaterial({ map: bubbleTex.contact, transparent: true, opacity: 0, depthWrite: false })
  const bubble = new THREE.Sprite(bubbleMat)
  bubble.scale.set(0.95, 0.72, 1)
  bubble.visible = false
  group.add(bubble)
  const COLORS = {
    contact: new THREE.Color('#e9f0ff').multiplyScalar(2),
    agent: new THREE.Color('#ffb347').multiplyScalar(2),
    alert: new THREE.Color('#53bdeb').multiplyScalar(2.2),
  }
  const tmp = new THREE.Vector3()
  const lift = new THREE.Vector3(0, 0.22, 0.05)

  const fly = (curve: THREE.QuadraticBezierCurve3, p: number, kind: 'contact' | 'agent' | 'alert', focus: number) => {
    curve.getPoint(clamp01(Math.min(1, p)), tmp)
    bubble.visible = p < 1
    bubble.position.copy(tmp).add(lift)
    if (bubbleMat.map !== bubbleTex[kind]) {
      bubbleMat.map = bubbleTex[kind]
      bubbleMat.needsUpdate = true
    }
    bubbleMat.opacity = clamp01(p / 0.12) * clamp01((1 - p) / 0.12 + 0.2) * focus
    trail.forEach((sp, k) => {
      const q = Math.min(1, p) - k * 0.045
      const on = q > 0 && p - k * 0.045 < 1.1
      sp.visible = on
      if (!on) return
      curve.getPoint(clamp01(q), tmp)
      sp.position.copy(tmp)
      sp.material.color.copy(COLORS[kind])
      sp.material.opacity = (k === 0 ? 1 : 0.75 * (1 - k / TRAIL)) * clamp01((1.15 - p) / 0.15) * focus
    })
  }

  return {
    update(light: Light, t: number, stage: { t: number; msgAt: number[]; who: string[] }, u: number) {
      const night = Math.min(1, light.lamps)
      // Peso del plano de la clínica: rótulos y vuelos solo se ven aquí
      const focus = clamp01(1 - Math.abs(u - 6.98) / 0.02)
      const s = stage.t
      const M = stage.msgAt
      const ready = M.length >= 8
      const urgentAt = ready ? M[1] : Infinity
      const offerAt = ready ? M[5] : Infinity
      const bookAt = ready ? M[7] : Infinity
      const alertStart = bookAt + 0.55
      const alertEnd = alertStart + ALERT
      const leaveAt = alertEnd + 1.1
      const WALK = 3.2

      for (const e of lit) e.mat.color.setScalar(e.base * (0.72 + night * 0.7))
      signMat.color.setScalar(1.05 * (0.72 + night * 0.7) * (1 - 0.04 * (0.5 + 0.5 * Math.sin(t * 5.1))))

      // Agenda: idle → urgencia → horas ofrecidas → agendada → equipo avisado
      const next: Agenda = s >= alertEnd ? 'notified' : s >= bookAt ? 'booked' : s >= offerAt ? 'offer' : s >= urgentAt ? 'urgent' : 'idle'
      if (next !== agenda) {
        agenda = next
        monitorMat.map = agendaTex[next]
        monitorMat.needsUpdate = true
      }
      // La pantalla «piensa» antes de cada respuesta y destella al llegar un mensaje
      let think = 0
      let flash = 0
      for (let i = 0; i < M.length; i += 1) {
        const d = s - M[i]
        if (stage.who[i] === 'agent' && d > -0.95 && d < 0) think = 1
        if (stage.who[i] === 'contact' && d >= 0 && d < 0.5) flash = Math.max(flash, 1 - d / 0.5)
      }
      const live = 0.9 + think * 0.25 * (0.5 + 0.5 * Math.sin(t * 14)) + flash * 0.5
      monitorMat.color.setScalar(live * (1.15 + night * 0.4))
      screenGlow.material.opacity = (0.22 + think * 0.18 + flash * 0.35) * (0.6 + night * 0.4)

      // Luz de urgencias
      const urgent = s >= urgentAt && s < bookAt
      const solved = s >= bookAt
      const beat = 0.5 + 0.5 * Math.sin(t * 6.5)
      if (urgent) alertMat.color.setRGB(1.6 + beat * 0.8, 0.35, 0.35)
      else if (solved) alertMat.color.setRGB(0.45, 1.7, 0.85)
      else alertMat.color.setScalar(0.35)
      badgeGlow.material.color.set(solved ? '#3ddc84' : '#ff4d4d')
      badgeGlow.material.opacity = urgent ? 0.25 + beat * 0.35 : solved ? 0.3 : 0

      // Camila: escribe frente a la puerta y, cuando queda agendada, se va tranquila
      const w = clamp01((s - leaveAt) / WALK)
      const e = w * w * (3 - 2 * w)
      const walking = w > 0 && w < 1
      camila.position.lerpVectors(stand, leave, e)
      camila.position.y = PERSON_H / 2 + (walking ? Math.abs(Math.sin(t * 9)) * 0.04 : 0)
      const frame = walking ? (Math.floor(t * 3.4) % 2 ? frames.a : frames.b) : w >= 1 ? frames.a : frames.phone
      if (camilaMat.map !== frame) {
        camilaMat.map = frame
        camilaMat.needsUpdate = true
      }
      camilaMat.opacity = 1 - clamp01((w - 0.7) / 0.3)
      let pulse = 0
      for (let i = 0; i < M.length; i += 1) {
        const d = s - M[i]
        if (stage.who[i] === 'contact' && d > -FLIGHT && d < 0.1) pulse = 1
        if (stage.who[i] === 'agent' && d >= 0 && d < 0.6) pulse = Math.max(pulse, 1 - d / 0.6)
      }
      camilaPhoneGlow.position.copy(stand).add(phoneOff)
      camilaPhoneGlow.material.opacity = w > 0 ? 0 : Math.max(s > 0 ? 0.55 : 0.3, pulse) * (0.75 + 0.25 * night)
      if (camilaTag.material !== (s >= bookAt ? camilaTagMats.calm : camilaTagMats.pain)) camilaTag.material = s >= bookAt ? camilaTagMats.calm : camilaTagMats.pain
      camilaTag.position.set(camila.position.x + 0.55, 0.12, camila.position.z + 0.3)
      camilaTag.material.opacity = focus * 0.95 * camilaMat.opacity

      // Dr. Rojas: a oscuras hasta que llega el aviso
      const on = clamp01((s - alertEnd) / 0.6)
      rojas.roomMat.color.setScalar(0.05 + on * 1.05)
      rojas.personMat.opacity = 0.12 + on * 0.88
      rojas.halo.material.opacity = on * (0.2 + 0.1 * night)
      const ping = s >= alertEnd ? Math.max(0.35, 1 - (s - alertEnd) / 2) : 0
      rojas.phone.material.opacity = ping * (0.75 + 0.25 * Math.sin(t * 7))
      rojas.phone.scale.setScalar(0.9 + ping * 0.5)
      rojasTag.material.opacity = focus * on * 0.95

      // Un vuelo a la vez: conversación con Camila y, al final, el aviso al equipo
      let shown = false
      if (focus > 0.02) {
        for (let i = 0; i < M.length && !shown; i += 1) {
          const p = (s - (M[i] - FLIGHT)) / FLIGHT
          if (p <= 0 || p >= 1.15) continue
          shown = true
          const contact = stage.who[i] === 'contact'
          fly(contact ? toClinic : toCamila, p, contact ? 'contact' : 'agent', focus)
        }
        const pa = (s - alertStart) / ALERT
        if (!shown && pa > 0 && pa < 1.15) {
          shown = true
          fly(toRojas, pa, 'alert', focus)
        }
      }
      if (!shown) {
        for (const sp of trail) sp.visible = false
        bubble.visible = false
      }
    },
  }
}

/** Letrero: «CLÍNICA SONRISA», con una muela. */
function signTexture() {
  return canvasTexture(1024, 128, (g, w, h) => {
    g.fillStyle = '#0f3d42'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = 'rgba(190, 240, 235, 0.5)'
    g.lineWidth = 4
    g.strokeRect(8, 8, w - 16, h - 16)
    drawTooth(g, 82, h / 2, 34, '#f4fbfa')
    g.textBaseline = 'middle'
    g.textAlign = 'left'
    g.fillStyle = '#f4fbfa'
    g.shadowColor = 'rgba(170, 245, 235, 0.85)'
    g.shadowBlur = 18
    g.font = '800 64px Archivo, Arial, sans-serif'
    g.fillText('CLÍNICA SONRISA', 140, h / 2 - 4)
    g.shadowBlur = 0
    g.fillStyle = '#9fded6'
    g.font = '600 24px Archivo, Arial, sans-serif'
    g.textAlign = 'right'
    g.fillText('ODONTOLOGÍA · URGENCIAS', w - 34, h / 2 + 2)
  })
}

function drawTooth(g: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string) {
  g.fillStyle = fill
  g.beginPath()
  g.moveTo(x - s, y - s * 0.55)
  g.bezierCurveTo(x - s, y - s * 1.15, x - s * 0.2, y - s * 1.05, x, y - s * 0.75)
  g.bezierCurveTo(x + s * 0.2, y - s * 1.05, x + s, y - s * 1.15, x + s, y - s * 0.55)
  g.bezierCurveTo(x + s, y + s * 0.1, x + s * 0.7, y + s * 0.3, x + s * 0.55, y + s * 1.05)
  g.quadraticCurveTo(x + s * 0.35, y + s * 1.2, x + s * 0.2, y + s * 0.6)
  g.quadraticCurveTo(x, y + s * 0.25, x - s * 0.2, y + s * 0.6)
  g.quadraticCurveTo(x - s * 0.35, y + s * 1.2, x - s * 0.55, y + s * 1.05)
  g.bezierCurveTo(x - s * 0.7, y + s * 0.3, x - s, y + s * 0.1, x - s, y - s * 0.55)
  g.fill()
}

/** Recepción cerrada: mesón, silla y una planta en penumbra fría. */
function receptionTexture() {
  return canvasTexture(512, 300, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, '#16222e')
    grad.addColorStop(1, '#0a1018')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
    // Cuadro en la pared
    g.fillStyle = 'rgba(140, 190, 200, 0.18)'
    g.fillRect(48, 46, 110, 74)
    // Mesón
    g.fillStyle = '#05080d'
    g.fillRect(150, 178, 330, 122)
    g.fillStyle = 'rgba(160, 210, 230, 0.16)'
    g.fillRect(150, 174, 330, 6)
    // Silla de espera y planta
    g.fillStyle = '#05080d'
    g.fillRect(30, 210, 70, 14)
    g.fillRect(36, 224, 8, 76)
    g.fillRect(86, 224, 8, 76)
    g.beginPath()
    g.ellipse(466, 140, 34, 52, 0, 0, Math.PI * 2)
    g.fill()
    g.fillRect(448, 186, 36, 40)
  })
}

/** La pantalla de la agenda de mañana, en sus cinco estados. */
function agendaTexture(state: Agenda) {
  return canvasTexture(512, 320, (g, w, h) => {
    g.fillStyle = '#0b1220'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#123f46'
    g.fillRect(0, 0, w, 52)
    g.fillStyle = '#d9f4f0'
    g.font = '700 26px Archivo, Arial, sans-serif'
    g.textBaseline = 'middle'
    g.textAlign = 'left'
    g.fillText('AGENDA · MAÑANA', 20, 27)
    if (state !== 'idle') {
      const red = state === 'urgent' || state === 'offer'
      g.fillStyle = red ? '#ff4d4d' : '#2fbf71'
      g.beginPath()
      g.roundRect(w - 182, 11, 166, 32, 16)
      g.fill()
      g.fillStyle = '#fff'
      g.font = '800 17px Archivo, Arial, sans-serif'
      g.textAlign = 'center'
      g.fillText(red ? 'URGENCIA · DOLOR' : 'PRIORIDAD ✓', w - 99, 28)
    }
    const rows: [string, string, 'free' | 'busy' | 'hot' | 'mine'][] = [
      ['09:00', 'Ocupado', 'busy'],
      ['09:30', state === 'booked' || state === 'notified' ? 'CAMILA · urgencia' : 'Libre', state === 'booked' || state === 'notified' ? 'mine' : state === 'offer' ? 'hot' : 'free'],
      ['10:00', 'Ocupado', 'busy'],
      ['11:00', 'Libre', state === 'offer' ? 'hot' : 'free'],
    ]
    rows.forEach(([hh, label, kind], i) => {
      const y = 72 + i * 48
      if (kind === 'hot' || kind === 'mine') {
        g.fillStyle = kind === 'mine' ? 'rgba(255, 179, 71, 0.95)' : 'rgba(255, 179, 71, 0.22)'
        g.beginPath()
        g.roundRect(14, y, w - 28, 40, 8)
        g.fill()
      }
      g.textAlign = 'left'
      g.font = '700 22px Archivo, Arial, sans-serif'
      g.fillStyle = kind === 'mine' ? '#2a1704' : '#9fb3c8'
      g.fillText(hh, 28, y + 21)
      g.font = kind === 'mine' ? '800 22px Archivo, Arial, sans-serif' : '500 22px Archivo, Arial, sans-serif'
      g.fillStyle = kind === 'mine' ? '#2a1704' : kind === 'busy' ? '#53627a' : kind === 'hot' ? '#ffd08a' : '#cfe0ea'
      g.fillText(label, 120, y + 21)
      if (kind === 'hot') {
        g.textAlign = 'right'
        g.fillStyle = '#ffb347'
        g.font = '600 17px Archivo, Arial, sans-serif'
        g.fillText('ofrecida', w - 28, y + 21)
      }
    })
    g.textAlign = 'left'
    g.font = '600 18px Archivo, Arial, sans-serif'
    const foot = state === 'notified' ? 'Equipo avisado · Dr. Rojas ✓' : state === 'booked' ? 'Avisando al equipo…' : 'Agente IA en línea'
    g.fillStyle = state === 'notified' ? '#5ff0a0' : '#8fd0ff'
    g.beginPath()
    g.arc(26, h - 26, 6, 0, Math.PI * 2)
    g.fill()
    g.fillText(foot, 42, h - 25)
  })
}

/** Cartel de la puerta. */
function closedTexture() {
  return canvasTexture(256, 104, (g, w, h) => {
    g.fillStyle = '#f2ece0'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#b3261e'
    g.font = '900 40px Archivo, Arial, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('CERRADO', w / 2, 40)
    g.fillStyle = '#4a4438'
    g.font = '600 22px Archivo, Arial, sans-serif'
    g.fillText('abre a las 9:00', w / 2, 80)
  })
}

/** Luz de urgencias: muela con una cruz (se tiñe con el color del material). */
function toothBadgeTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,0)'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.arc(w / 2, h / 2, 58, 0, Math.PI * 2)
    g.fill()
    drawTooth(g, w / 2, h / 2 + 4, 30, '#1a1a1a')
    g.fillStyle = '#ffffff'
    g.fillRect(w / 2 - 4, h / 2 - 12, 8, 26)
    g.fillRect(w / 2 - 13, h / 2 - 3, 26, 8)
  })
}

/** Rótulo pintado, del mismo estilo que los rótulos de la noche. */
function tagTexture(title: string, sub: string) {
  return canvasTexture(512, 140, (g, w, h) => {
    g.fillStyle = 'rgba(5, 8, 16, 0.86)'
    g.strokeStyle = 'rgba(239, 231, 216, 0.38)'
    g.lineWidth = 3
    g.beginPath()
    g.roundRect(6, 6, w - 12, h - 12, 12)
    g.fill()
    g.stroke()
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = '#efe7d8'
    g.font = '700 40px "JetBrains Mono", Menlo, monospace'
    g.fillText(title.toUpperCase().split('').join(' '), w / 2, 48)
    g.fillStyle = '#ffb347'
    g.font = '500 34px Archivo, Arial, sans-serif'
    g.fillText(sub, w / 2, 100)
  })
}

/** El aviso al equipo: un sobre celeste (el mismo color que el correo de la noche). */
function envelopeTexture() {
  return canvasTexture(160, 120, (g) => {
    g.shadowColor = 'rgba(83, 189, 235, 0.95)'
    g.shadowBlur = 14
    g.fillStyle = '#53bdeb'
    g.beginPath()
    g.roundRect(20, 22, 120, 78, 12)
    g.fill()
    g.shadowBlur = 0
    g.strokeStyle = '#0b2a3a'
    g.lineWidth = 7
    g.lineJoin = 'round'
    g.beginPath()
    g.moveTo(28, 32)
    g.lineTo(80, 70)
    g.lineTo(132, 32)
    g.stroke()
  })
}
