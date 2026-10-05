import * as THREE from 'three'
import { FRONT_Z } from './city'
import type { Light } from './palette'
import { canvasTexture } from './textures'

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

  return {
    update(light: Light, t: number) {
      const night = Math.min(1, light.lamps)
      for (const e of lit) {
        const flick = e.flick ? 1 - e.flick * 0.06 * (0.5 + 0.5 * Math.sin(t * 7.3 + e.base)) : 1
        // Siempre encendido (se lee de día), y de noche sube para que lo tome el bloom.
        e.mat.color.setScalar(e.base * (0.72 + night * 0.7) * flick)
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
