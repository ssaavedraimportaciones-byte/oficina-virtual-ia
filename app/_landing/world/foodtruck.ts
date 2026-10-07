import * as THREE from 'three'
import { FRONT_Z } from './city'
import type { Light } from './palette'
import { canvasTexture, glowTexture } from './textures'

/**
 * El carro de completos: un food truck estacionado al final de la calle de los
 * rubros, justo donde la cámara sube hacia la vista aérea (ver la sección
 * «food truck» de la página). Da vida a esa esquina y pone en escena lo que
 * hace el agente para un carro de comida: un letrero iluminado de comida rápida
 * y una carta con completos y churrascos.
 *
 * Todo es geometría + texturas pintadas (sin imágenes que descargar). El
 * letrero, la carta y la plancha se auto-iluminan de noche (el bloom hace el
 * resto), siguiendo la hora del día como el resto del mundo.
 */

/** Dibuja un completo (pan, vienesa, palta, tomate, mayo). */
function drawCompleto(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Pan de abajo
  g.fillStyle = '#e8b36a'
  g.beginPath()
  g.ellipse(x, y + s * 0.18, s * 0.95, s * 0.34, 0, 0, Math.PI * 2)
  g.fill()
  // Vienesa
  g.fillStyle = '#b5472f'
  g.beginPath()
  g.ellipse(x, y, s * 0.92, s * 0.26, 0, 0, Math.PI * 2)
  g.fill()
  // Palta
  g.fillStyle = '#5f9a4a'
  g.beginPath()
  g.ellipse(x, y - s * 0.12, s * 0.86, s * 0.2, 0, Math.PI, Math.PI * 2)
  g.fill()
  // Tomate picado
  g.fillStyle = '#d64b3a'
  for (let i = -3; i <= 3; i += 1) {
    g.beginPath()
    g.arc(x + i * s * 0.22, y - s * 0.16, s * 0.1, 0, Math.PI * 2)
    g.fill()
  }
  // Hilo de mayo
  g.strokeStyle = '#fff4de'
  g.lineWidth = s * 0.12
  g.lineCap = 'round'
  g.beginPath()
  for (let i = 0; i <= 10; i += 1) {
    const px = x - s * 0.8 + (i / 10) * s * 1.6
    const py = y - s * 0.26 + Math.sin(i * 1.5) * s * 0.07
    i === 0 ? g.moveTo(px, py) : g.lineTo(px, py)
  }
  g.stroke()
  // Pan de arriba
  g.fillStyle = '#edbd7a'
  g.beginPath()
  g.ellipse(x, y - s * 0.34, s * 0.92, s * 0.26, 0, Math.PI, Math.PI * 2)
  g.fill()
}

/** Letrero luminoso del techo: «COMPLETOS» con un completo dibujado. */
function roofSignTexture() {
  return canvasTexture(1024, 256, (g, w, h) => {
    g.fillStyle = '#140a06'
    g.fillRect(0, 0, w, h)
    // Marco de ampolletas
    g.strokeStyle = 'rgba(255,196,110,0.5)'
    g.lineWidth = 10
    g.strokeRect(16, 16, w - 32, h - 32)
    g.fillStyle = '#ffd98a'
    for (let i = 0; i < 26; i += 1) {
      const t = i / 25
      g.beginPath(); g.arc(28 + t * (w - 56), 28, 5, 0, Math.PI * 2); g.fill()
      g.beginPath(); g.arc(28 + t * (w - 56), h - 28, 5, 0, Math.PI * 2); g.fill()
    }
    // Completo a la izquierda
    drawCompleto(g, 130, h / 2 + 6, 78)
    // Texto (ajustado para que «COMPLETOS» entre completo en el canvas)
    g.fillStyle = '#ffdf99'
    g.font = '900 118px Archivo, Arial, sans-serif'
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.shadowColor = 'rgba(255,170,70,0.9)'
    g.shadowBlur = 32
    g.fillText('COMPLETOS', 232, h / 2 - 2)
    g.shadowBlur = 0
  })
}

/** Carta lateral tipo pizarra: completos y churrascos con precios. */
function menuTexture() {
  return canvasTexture(512, 640, (g, w, h) => {
    g.fillStyle = '#16140f'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = 'rgba(255,210,150,0.35)'
    g.lineWidth = 8
    g.strokeRect(14, 14, w - 28, h - 28)
    g.textAlign = 'center'
    g.fillStyle = '#ffd98a'
    g.font = '800 62px Archivo, Arial, sans-serif'
    g.fillText('LA CARTA', w / 2, 86)
    g.strokeStyle = 'rgba(255,210,150,0.4)'
    g.lineWidth = 3
    g.beginPath(); g.moveTo(60, 120); g.lineTo(w - 60, 120); g.stroke()
    const items: [string, string][] = [
      ['Completo italiano', '$3.500'],
      ['Churrasco palta', '$5.900'],
      ['Papas fritas (M)', '$2.500'],
      ['Bebida en lata', '$1.500'],
    ]
    g.textBaseline = 'middle'
    g.font = '500 40px Archivo, Arial, sans-serif'
    items.forEach(([name, price], i) => {
      const y = 190 + i * 96
      g.textAlign = 'left'
      g.fillStyle = '#f3e7cf'
      g.fillText(name, 56, y)
      g.textAlign = 'right'
      g.fillStyle = '#ffc879'
      g.fillText(price, w - 56, y)
      g.strokeStyle = 'rgba(255,210,150,0.18)'
      g.beginPath(); g.moveTo(56, y + 38); g.lineTo(w - 56, y + 38); g.stroke()
    })
    g.textAlign = 'center'
    g.fillStyle = '#9c8f76'
    g.font = 'italic 30px Archivo, Arial, sans-serif'
    g.fillText('Plaza Ñuñoa · hasta 23:00', w / 2, h - 46)
  })
}

/** Brillo cálido de la plancha vista por la ventana de atención. */
function windowGlowTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h * 0.7, 4, w / 2, h * 0.7, w * 0.7)
    grad.addColorStop(0, '#ffdca0')
    grad.addColorStop(0.5, '#e8922f')
    grad.addColorStop(1, '#120a04')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
    // Siluetas: plancha y utensilios
    g.fillStyle = 'rgba(20,12,6,0.65)'
    g.fillRect(0, h * 0.72, w, h * 0.28)
    g.fillRect(w * 0.18, h * 0.5, w * 0.64, 10)
  })
}

export function createFoodTruck(scene: THREE.Scene) {
  const group = new THREE.Group()
  // Al final de la calle de rubros (último local ≈ x 71.6), sobre la vereda
  // delantera, girado para mostrar la ventana de atención a la cámara.
  group.position.set(69.2, 0, FRONT_Z + 7.1)
  group.rotation.y = -0.46
  group.scale.setScalar(0.92)
  scene.add(group)

  const lit: { mat: THREE.MeshBasicMaterial; base: number; flick?: number }[] = []
  const emissive = (geo: THREE.BufferGeometry, map: THREE.Texture, base: number, flick = 0) => {
    const mat = new THREE.MeshBasicMaterial({ map, color: new THREE.Color(0, 0, 0) })
    lit.push({ mat, base, flick })
    const m = new THREE.Mesh(geo, mat)
    group.add(m)
    return m
  }

  // --- Carrocería -------------------------------------------------------------
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#ece2cd', roughness: 0.42, metalness: 0.55, envMapIntensity: 1.1 })
  const trimMat = new THREE.MeshStandardMaterial({ color: '#9e2b25', roughness: 0.4, metalness: 0.5, envMapIntensity: 1.0 })
  const darkMat = new THREE.MeshStandardMaterial({ color: '#211d19', roughness: 0.6, metalness: 0.4 })
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#c9ccd2', roughness: 0.22, metalness: 0.9, envMapIntensity: 1.5 })

  const L = 5.0 // largo (x)
  const Hb = 1.95 // alto carrocería
  const D = 2.6 // fondo (z)
  const wheelR = 0.52
  const bodyY = wheelR + 0.28 + Hb / 2

  const body = new THREE.Mesh(new THREE.BoxGeometry(L, Hb, D), bodyMat)
  body.position.set(0, bodyY, 0)
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // Franja roja a media altura
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(L + 0.02, 0.34, D + 0.02), trimMat)
  stripe.position.set(0, wheelR + 0.28 + 0.5, 0)
  group.add(stripe)

  // Zócalo / faldón oscuro
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(L + 0.04, 0.5, D + 0.04), darkMat)
  skirt.position.set(0, wheelR + 0.28 - 0.1, 0)
  group.add(skirt)

  // Cabina (adelante, -x)
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.5, D - 0.1), bodyMat)
  cab.position.set(-L / 2 - 0.55, wheelR + 0.28 + 0.75, 0)
  cab.castShadow = true
  group.add(cab)
  const windshield = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.8),
    new THREE.MeshStandardMaterial({ color: '#10151f', roughness: 0.08, metalness: 0.85, envMapIntensity: 1.6 }),
  )
  windshield.position.set(-L / 2 - 1.18, wheelR + 0.28 + 0.95, 0)
  windshield.rotation.y = -Math.PI / 2
  group.add(windshield)

  // Techo curvo (cilindro achatado)
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, L, 16, 1, false, 0, Math.PI), bodyMat)
  roof.rotation.z = Math.PI / 2
  roof.scale.set(1, 1, D / 1.0)
  roof.position.set(0, bodyY + Hb / 2, 0)
  group.add(roof)

  // Ruedas
  const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.42, 22)
  const hubGeo = new THREE.CylinderGeometry(wheelR * 0.45, wheelR * 0.45, 0.44, 12)
  for (const wx of [-1.5, 1.6]) {
    for (const wz of [-1, 1]) {
      const tire = new THREE.Mesh(wheelGeo, darkMat)
      tire.rotation.x = Math.PI / 2
      tire.position.set(wx, wheelR, wz * (D / 2 - 0.1))
      tire.castShadow = true
      group.add(tire)
      const hub = new THREE.Mesh(hubGeo, chromeMat)
      hub.rotation.x = Math.PI / 2
      hub.position.set(wx, wheelR, wz * (D / 2 - 0.02))
      group.add(hub)
    }
  }

  // --- Lado de atención (+z, hacia la cámara) ---------------------------------
  const faceZ = D / 2 + 0.02
  // Hueco oscuro de la ventana
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.05), new THREE.MeshStandardMaterial({ color: '#0a0806', roughness: 0.9 }))
  hole.position.set(0.5, bodyY + 0.12, faceZ)
  group.add(hole)
  // Brillo de la plancha dentro
  emissive(new THREE.PlaneGeometry(2.5, 0.98), windowGlowTexture(), 1.15).position.set(0.5, bodyY + 0.12, faceZ + 0.01)
  const windowLit = lit[lit.length - 1]
  // Repisa / mesón
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.5), chromeMat)
  ledge.position.set(0.5, bodyY - 0.42, faceZ + 0.22)
  ledge.castShadow = true
  group.add(ledge)

  // Toldo a rayas sobre la ventana
  const awning = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 0.95),
    new THREE.MeshStandardMaterial({ map: awningStripes(), side: THREE.DoubleSide, roughness: 0.85 }),
  )
  awning.position.set(0.5, bodyY + 0.78, faceZ + 0.42)
  awning.rotation.x = -Math.PI / 2 + 0.62
  awning.castShadow = true
  group.add(awning)

  // Carta iluminada a la izquierda de la ventana
  emissive(new THREE.PlaneGeometry(1.25, 1.56), menuTexture(), 0.92).position.set(-1.75, bodyY + 0.05, faceZ)

  // --- Letrero del techo ------------------------------------------------------
  const signBox = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.82, 0.28), darkMat)
  signBox.position.set(0.3, bodyY + Hb / 2 + 0.95, 0.15)
  group.add(signBox)
  // Patas del letrero
  for (const sx of [-1.1, 1.6]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), chromeMat)
    leg.position.set(0.3 + sx, bodyY + Hb / 2 + 0.5, 0.15)
    group.add(leg)
  }
  emissive(new THREE.PlaneGeometry(3.1, 0.74), roofSignTexture(), 1.35, 0.6).position.set(0.3, bodyY + Hb / 2 + 0.95, 0.15 + 0.15)

  // --- Sombra de contacto -----------------------------------------------------
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(L + 2.4, D + 2.0),
    new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false, opacity: 0.55 }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.set(0, 0.02, 0)
  group.add(shadow)

  // --- La puesta en escena: cómo trabaja el carro con el agente ------------------
  // Nico, el cliente, escribe desde la vereda; cada mensaje viaja como una luz entre
  // su teléfono y el carro (mismo lenguaje que la noche de Uñas Bella), la plancha
  // se aviva cuando entra el pedido y, cuando está listo, Nico cruza a buscarlo.
  // Todo se deriva del segundo de la conversación (bus.truck), así el chat de la
  // página y la escena 3D cuentan lo mismo al mismo tiempo, hacia adelante o atrás.
  const glow = glowTexture()
  const PERSON_H = 1.9 // en unidades del grupo (escala 0.92 → ~1,75 m)
  const start = new THREE.Vector3(-3.3, 0, 5.6) // en la vereda, frente a la cabina
  const stand = new THREE.Vector3(0.35, 0, 2.25) // frente a la ventana de atención
  const frames = { a: personTexture('walkA'), b: personTexture('walkB'), phone: personTexture('phone'), bag: personTexture('bag') }
  const personMat = new THREE.SpriteMaterial({ map: frames.phone, transparent: true, depthWrite: false })
  const person = new THREE.Sprite(personMat)
  person.scale.set(PERSON_H * 0.4, PERSON_H, 1)
  person.position.set(start.x, PERSON_H / 2, start.z)
  group.add(person)
  const phoneGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#b9dcff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
  phoneGlow.scale.set(1, 1, 1)
  group.add(phoneGlow)

  // Pizarra de pedidos junto a la cabina: ABIERTO → EN LA PLANCHA → ¡LISTO!
  const boardTex = [boardTexture('open'), boardTexture('cooking'), boardTexture('ready')]
  const boardMat = new THREE.MeshBasicMaterial({ map: boardTex[0], color: new THREE.Color(1, 1, 1) })
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.78), boardMat)
  board.position.set(-3.05, 1.05, 2.35)
  board.rotation.y = 0.32
  group.add(board)
  for (const lx of [-0.5, 0.5]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.05, 0.05), darkMat)
    leg.position.set(-3.05 + lx * Math.cos(0.32), 0.5, 2.35 - lx * Math.sin(0.32) - 0.06)
    group.add(leg)
  }
  let boardState = 0

  // Vapor de la plancha (solo mientras se cocina)
  const steam = Array.from({ length: 9 }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#e9eef6', transparent: true, opacity: 0, depthWrite: false }))
    group.add(sp)
    return sp
  })

  // Un mensaje en vuelo: luz con estela entre el teléfono de Nico y la ventana
  const windowAt = new THREE.Vector3(0.5, bodyY + 0.15, faceZ + 0.25)
  const phoneAt = start.clone().add(new THREE.Vector3(0.22, PERSON_H * 0.66, 0.1))
  const arc = (a: THREE.Vector3, b: THREE.Vector3) => new THREE.QuadraticBezierCurve3(a, a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, 2.8, 0.15)), b)
  const toTruck = arc(phoneAt, windowAt)
  const toPhone = arc(windowAt, phoneAt)
  const FLIGHT = 0.75
  const TRAIL = 8
  const trail = Array.from({ length: TRAIL }, (_, k) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
    const size = k === 0 ? 1.1 : 0.7 * (1 - k / TRAIL)
    sp.scale.set(size, size, 1)
    group.add(sp)
    return sp
  })
  // La cabeza del vuelo es una burbuja de chat (se entiende como mensaje, no como un reflejo)
  const bubbleTex = { contact: bubbleTexture('contact'), agent: bubbleTexture('agent') }
  const bubbleMat = new THREE.SpriteMaterial({ map: bubbleTex.contact, transparent: true, opacity: 0, depthWrite: false })
  const bubble = new THREE.Sprite(bubbleMat)
  bubble.scale.set(0.95, 0.72, 1)
  bubble.visible = false
  group.add(bubble)
  const C_CONTACT = new THREE.Color('#e9f0ff').multiplyScalar(2)
  const C_AGENT = new THREE.Color('#ffb347').multiplyScalar(2)
  const tmp = new THREE.Vector3()
  const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

  return {
    update(light: Light, t: number, stage: { t: number; msgAt: number[]; who: string[] }) {
      const night = Math.min(1, light.lamps)
      const s = stage.t
      const M = stage.msgAt
      const ready = M.length >= 9
      const cookAt = ready ? M[7] : Infinity
      const readyAt = ready ? M[8] : Infinity
      const walkAt = readyAt + 0.5
      const WALK = 2.6

      // Llegada de cada mensaje a la ventana: un destello en la plancha
      let flash = 0
      for (let i = 0; i < M.length; i += 1) {
        const d = s - M[i]
        if (d >= 0 && d < 0.5 && stage.who[i] === 'contact') flash = Math.max(flash, 1 - d / 0.5)
      }
      // Cocinando: de que se confirma la hora de retiro hasta poco después de «listo»
      const cook = s >= cookAt ? clamp01((s - cookAt) / 0.8) * (s < readyAt + 2.5 ? 1 : clamp01(1 - (s - readyAt - 2.5) / 2)) : 0
      const windowBoost = 1 + cook * 0.75 * (0.85 + 0.15 * Math.sin(t * 13)) + flash * 0.6

      for (const e of lit) {
        const flick = e.flick ? 1 - e.flick * 0.06 * (0.5 + 0.5 * Math.sin(t * 7.3 + e.base)) : 1
        // Siempre encendido (se lee de día), y de noche sube para que lo tome el bloom.
        e.mat.color.setScalar(e.base * (0.72 + night * 0.7) * flick * (e === windowLit ? windowBoost : 1))
      }

      // Pizarra
      const state = s >= readyAt ? 2 : s >= cookAt ? 1 : 0
      if (state !== boardState) {
        boardState = state
        boardMat.map = boardTex[state]
        boardMat.needsUpdate = true
      }
      boardMat.color.setScalar((0.95 + night * 0.4) * (state === 2 ? 1 + 0.25 * Math.max(0, Math.sin(t * 6)) : 1))

      // Vapor
      steam.forEach((sp, k) => {
        const ph = (t * 0.42 + k / steam.length) % 1
        sp.position.set(windowAt.x - 0.6 + (k % 3) * 0.6 + Math.sin(ph * 5 + k) * 0.18, bodyY + 0.75 + ph * 1.9, faceZ + 0.35)
        const size = 0.6 + ph * 1.6
        sp.scale.set(size, size, 1)
        sp.material.opacity = cook * 0.34 * Math.sin(ph * Math.PI)
      })

      // Nico: escribe desde la vereda y, cuando el pedido está listo, cruza a buscarlo
      const w = clamp01((s - walkAt) / WALK)
      const e = w * w * (3 - 2 * w)
      const walking = w > 0 && w < 1
      person.position.lerpVectors(start, stand, e)
      person.position.y = PERSON_H / 2 + (walking ? Math.abs(Math.sin(t * 9)) * 0.05 : 0)
      const map = walking ? (Math.floor(t * 3.4) % 2 ? frames.a : frames.b) : w >= 1 ? frames.bag : frames.phone
      if (personMat.map !== map) {
        personMat.map = map
        personMat.needsUpdate = true
      }
      // La silueta se ilumina un poco con la luz cálida del carro al acercarse
      personMat.color.setRGB(1 + e * 0.5, 1 + e * 0.35, 1 + e * 0.2)

      // Pantalla del teléfono: viva mientras conversa; se enciende fuerte al enviar o recibir
      let pulse = 0
      for (let i = 0; i < M.length; i += 1) {
        const d = s - M[i]
        if (stage.who[i] === 'contact' && d > -FLIGHT && d < 0.1) pulse = 1
        if (stage.who[i] === 'agent' && d >= 0 && d < 0.6) pulse = Math.max(pulse, 1 - d / 0.6)
      }
      const chatting = s > 0 && w === 0 ? 0.6 : 0
      phoneGlow.position.copy(phoneAt).lerp(stand.clone().add(new THREE.Vector3(0.22, PERSON_H * 0.66, 0.1)), e)
      phoneGlow.material.opacity = w >= 1 ? 0 : Math.max(chatting, pulse) * (0.7 + 0.3 * night)

      // Mensajes en vuelo (uno a la vez: la conversación nunca los superpone)
      let shown = false
      for (let i = 0; i < M.length && !shown; i += 1) {
        const p = (s - (M[i] - FLIGHT)) / FLIGHT
        if (p <= 0 || p >= 1.15) continue
        shown = true
        const contact = stage.who[i] === 'contact'
        const curve = contact ? toTruck : toPhone
        const color = contact ? C_CONTACT : C_AGENT
        curve.getPoint(clamp01(Math.min(1, p)), tmp)
        bubble.visible = p < 1
        bubble.position.copy(tmp).add(new THREE.Vector3(0, 0.22, 0.05))
        const map = contact ? bubbleTex.contact : bubbleTex.agent
        if (bubbleMat.map !== map) {
          bubbleMat.map = map
          bubbleMat.needsUpdate = true
        }
        bubbleMat.opacity = clamp01(p / 0.12) * clamp01((1 - p) / 0.12 + 0.2)
        trail.forEach((sp, k) => {
          const q = Math.min(1, p) - k * 0.045
          const on = q > 0 && p - k * 0.045 < 1.1
          sp.visible = on
          if (!on) return
          curve.getPoint(clamp01(q), tmp)
          sp.position.copy(tmp)
          sp.material.color.copy(color)
          sp.material.opacity = (k === 0 ? 1 : 0.75 * (1 - k / TRAIL)) * clamp01((1.15 - p) / 0.15)
        })
      }
      if (!shown) {
        for (const sp of trail) sp.visible = false
        bubble.visible = false
      }
    },
  }
}

/** Rayas del toldo (rojo/crema). */
function awningStripes() {
  return canvasTexture(256, 96, (g, w, h) => {
    for (let i = 0; i < 8; i += 1) {
      g.fillStyle = i % 2 ? '#c13a2f' : '#f0e6d2'
      g.fillRect((i / 8) * w, 0, w / 8 + 1, h)
    }
    g.fillStyle = 'rgba(0,0,0,0.12)'
    g.fillRect(0, h * 0.7, w, h * 0.3)
  })
}

/** Mancha de sombra blanda bajo el carro. */
function contactShadow() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#000'
    g.fillRect(0, 0, w, h)
    const grad = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2)
    grad.addColorStop(0, 'rgba(0,0,0,1)')
    grad.addColorStop(0.6, 'rgba(0,0,0,0.5)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.globalCompositeOperation = 'source-in'
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
  }, false)
}


/** Nico, de cuerpo entero, de perfil hacia la derecha (hacia el carro). Luz de borde cálida. */
function personTexture(pose: 'walkA' | 'walkB' | 'phone' | 'bag') {
  return canvasTexture(160, 400, (g) => {
    const draw = (fill: string, dx: number) => {
      g.fillStyle = fill
      g.save()
      g.translate(dx, 0)
      // Cabeza y cuello
      g.beginPath()
      g.arc(84, 48, 25, 0, Math.PI * 2)
      g.fill()
      g.fillRect(76, 66, 16, 18)
      // Torso con chaqueta
      g.beginPath()
      g.moveTo(50, 92)
      g.quadraticCurveTo(84, 78, 116, 92)
      g.lineTo(112, 214)
      g.lineTo(56, 214)
      g.closePath()
      g.fill()
      // Piernas
      const leg = (x0: number, x1: number) => {
        g.beginPath()
        g.moveTo(x0 - 13, 210)
        g.lineTo(x0 + 13, 210)
        g.lineTo(x1 + 11, 384)
        g.lineTo(x1 - 11, 384)
        g.closePath()
        g.fill()
        g.fillRect(x1 - 12, 380, pose === 'walkA' || pose === 'walkB' ? 30 : 28, 12)
      }
      if (pose === 'walkA') {
        leg(72, 46)
        leg(96, 120)
      } else if (pose === 'walkB') {
        leg(72, 92)
        leg(96, 76)
      } else {
        leg(72, 70)
        leg(96, 98)
      }
      // Brazo: con el teléfono frente al pecho, o colgando con la bolsa
      if (pose === 'bag') {
        g.fillRect(104, 100, 16, 100)
        g.fillStyle = fill === '#05070d' ? '#c99a5e' : fill
        g.fillRect(100, 196, 34, 42)
      } else if (pose === 'phone') {
        g.beginPath()
        g.moveTo(104, 100)
        g.lineTo(118, 104)
        g.lineTo(132, 150)
        g.lineTo(120, 156)
        g.closePath()
        g.fill()
        g.fillRect(118, 140, 22, 14)
      } else {
        g.fillRect(100, 100, 15, 92)
      }
      g.restore()
    }
    draw('rgba(255, 170, 80, 0.75)', 3) // luz de borde, del lado del carro
    draw('#05070d', 0)
  })
}

/** Pizarra de pedidos del carro, en sus tres estados. */
function boardTexture(state: 'open' | 'cooking' | 'ready') {
  return canvasTexture(512, 320, (g, w, h) => {
    g.fillStyle = '#121310'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = state === 'ready' ? 'rgba(61, 220, 132, 0.8)' : 'rgba(255, 196, 110, 0.55)'
    g.lineWidth = 10
    g.strokeRect(10, 10, w - 20, h - 20)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = '#b8ab92'
    g.font = '700 34px Archivo, Arial, sans-serif'
    g.fillText('PEDIDOS', w / 2, 62)
    const big = state === 'open' ? 'ABIERTO' : state === 'cooking' ? 'EN LA PLANCHA' : '¡LISTO, NICO!'
    const small = state === 'open' ? 'hasta las 23:00' : state === 'cooking' ? 'pedido de Nico · 21:55' : 'pasa a buscarlo ✓'
    g.fillStyle = state === 'ready' ? '#5ff0a0' : '#ffd98a'
    g.shadowColor = state === 'ready' ? 'rgba(61, 220, 132, 0.9)' : 'rgba(255, 170, 70, 0.9)'
    g.shadowBlur = 24
    g.font = `900 ${state === 'open' ? 92 : 64}px Archivo, Arial, sans-serif`
    g.fillText(big, w / 2, 160)
    g.shadowBlur = 0
    g.fillStyle = '#e9dfcb'
    g.font = 'italic 36px Archivo, Arial, sans-serif'
    g.fillText(small, w / 2, 250)
  })
}

/** Burbuja de chat con puntitos: blanca (mensaje de Nico) o ámbar (respuesta del agente). */
function bubbleTexture(kind: 'contact' | 'agent') {
  return canvasTexture(160, 120, (g) => {
    const fill = kind === 'agent' ? '#ffb347' : '#f2f5ff'
    g.shadowColor = kind === 'agent' ? 'rgba(255, 170, 70, 0.9)' : 'rgba(190, 215, 255, 0.9)'
    g.shadowBlur = 14
    g.fillStyle = fill
    g.beginPath()
    g.roundRect(14, 12, 132, 78, 26)
    g.fill()
    // Colita de la burbuja
    g.beginPath()
    if (kind === 'agent') {
      g.moveTo(112, 84)
      g.lineTo(136, 110)
      g.lineTo(92, 88)
    } else {
      g.moveTo(48, 84)
      g.lineTo(24, 110)
      g.lineTo(68, 88)
    }
    g.fill()
    g.shadowBlur = 0
    g.fillStyle = kind === 'agent' ? '#3a2208' : '#26304a'
    for (const x of [52, 80, 108]) {
      g.beginPath()
      g.arc(x, 51, 9, 0, Math.PI * 2)
      g.fill()
    }
  })
}
