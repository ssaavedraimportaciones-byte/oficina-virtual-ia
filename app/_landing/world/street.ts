import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { STREET, streetX, type StreetShop } from '../data'
import { FACE_Z, FRONT_Z, worldBox, type Emitter } from './city'
import type { Light } from './palette'
import { awningTexture, canvasTexture, facadeTexture, mulberry32, signTexture } from './textures'

/**
 * La calle de los rubros: nueve locales en fila, cada uno con su letrero y su
 * interior. A medida que baja el scroll se van encendiendo uno a uno; desde
 * arriba, cada negocio queda dentro de su propio haz de luz (nada se mezcla).
 */

/** Interior pintado de cada rubro: siluetas simples sobre la luz del local. */
function interiorTexture(shop: StreetShop) {
  return canvasTexture(512, 320, (g, w, h) => {
    const rand = mulberry32(shop.id.length * 97)
    const base = new THREE.Color(shop.glow)
    const deep = base.clone().multiplyScalar(0.32)
    const grad = g.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, `#${base.getHexString()}`)
    grad.addColorStop(1, `#${deep.getHexString()}`)
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
    // Piso
    g.fillStyle = 'rgba(0,0,0,0.25)'
    g.fillRect(0, h * 0.78, w, h * 0.22)
    const ink = 'rgba(20,18,22,0.82)'
    g.fillStyle = ink
    g.strokeStyle = ink
    const rect = (x: number, y: number, rw: number, rh: number, c = ink) => {
      g.fillStyle = c
      g.fillRect(x, y, rw, rh)
    }
    switch (shop.id) {
      case 'odontologia': {
        // Sillón dental, lámpara y mueble
        g.beginPath()
        g.moveTo(150, 250)
        g.quadraticCurveTo(170, 190, 250, 200)
        g.lineTo(330, 170)
        g.lineTo(345, 185)
        g.lineTo(270, 225)
        g.quadraticCurveTo(220, 240, 210, 262)
        g.closePath()
        g.fill()
        rect(220, 262, 30, 30)
        g.lineWidth = 6
        g.beginPath()
        g.moveTo(380, 40)
        g.lineTo(330, 110)
        g.stroke()
        g.beginPath()
        g.arc(325, 118, 18, 0, Math.PI * 2)
        g.fillStyle = 'rgba(255,255,255,0.9)'
        g.fill()
        rect(400, 160, 80, 110)
        break
      }
      case 'taller': {
        // Auto en elevador, tablero de herramientas
        g.beginPath()
        g.moveTo(110, 200)
        g.quadraticCurveTo(140, 140, 230, 138)
        g.lineTo(320, 140)
        g.quadraticCurveTo(380, 150, 400, 200)
        g.closePath()
        g.fill()
        for (const x of [160, 350]) {
          g.beginPath()
          g.arc(x, 205, 24, 0, Math.PI * 2)
          g.fill()
        }
        rect(100, 230, 320, 10)
        rect(30, 40, 90, 110, 'rgba(20,18,22,0.4)')
        for (let i = 0; i < 18; i += 1) rect(38 + (i % 6) * 13, 50 + Math.floor(i / 6) * 32, 5, 22)
        break
      }
      case 'peluqueria': {
        for (const x of [120, 300]) {
          rect(x, 40, 110, 120, 'rgba(255,255,255,0.35)')
          g.strokeStyle = 'rgba(255,240,220,0.9)'
          g.lineWidth = 4
          g.strokeRect(x, 40, 110, 120)
          g.fillStyle = ink
          g.beginPath()
          g.roundRect(x + 20, 170, 70, 70, 12)
          g.fill()
          rect(x + 48, 240, 14, 40)
        }
        break
      }
      case 'inmobiliaria': {
        // Vitrina de avisos de propiedades
        for (let r = 0; r < 3; r += 1) {
          for (let c = 0; c < 5; c += 1) {
            const x = 40 + c * 90
            const y = 30 + r * 82
            rect(x, y, 74, 66, 'rgba(255,255,255,0.92)')
            g.fillStyle = 'rgba(40,60,90,0.8)'
            g.beginPath()
            g.moveTo(x + 14, y + 34)
            g.lineTo(x + 37, y + 14)
            g.lineTo(x + 60, y + 34)
            g.closePath()
            g.fill()
            rect(x + 18, y + 34, 38, 14, 'rgba(40,60,90,0.8)')
            rect(x + 10, y + 54, 54, 5, 'rgba(194,65,12,0.9)')
          }
        }
        break
      }
      case 'gastronomia': {
        for (const x of [90, 250, 410]) {
          rect(x - 45, 200, 90, 10)
          rect(x - 4, 210, 8, 60)
          const lamp = g.createRadialGradient(x, 60, 2, x, 60, 60)
          lamp.addColorStop(0, 'rgba(255,255,230,0.95)')
          lamp.addColorStop(1, 'rgba(255,255,230,0)')
          g.fillStyle = lamp
          g.fillRect(x - 60, 0, 120, 130)
          for (const dx of [-55, 55]) {
            g.fillStyle = ink
            g.beginPath()
            g.roundRect(x + dx - 14, 180, 28, 90, 6)
            g.fill()
          }
        }
        rect(200, 70, 110, 70, '#1d2621')
        g.strokeStyle = 'rgba(255,255,255,0.7)'
        g.lineWidth = 2
        for (let i = 0; i < 4; i += 1) {
          g.beginPath()
          g.moveTo(212, 86 + i * 14)
          g.lineTo(212 + 40 + rand() * 45, 86 + i * 14)
          g.stroke()
        }
        break
      }
      case 'gimnasio': {
        // Rack de mancuernas y una trotadora
        rect(40, 190, 220, 10)
        for (let i = 0; i < 6; i += 1) {
          const x = 55 + i * 34
          rect(x, 178, 22, 6)
          g.fillStyle = ink
          g.beginPath()
          g.arc(x, 181, 9, 0, Math.PI * 2)
          g.arc(x + 22, 181, 9, 0, Math.PI * 2)
          g.fill()
        }
        g.beginPath()
        g.moveTo(320, 250)
        g.lineTo(470, 230)
        g.lineTo(470, 245)
        g.lineTo(320, 268)
        g.closePath()
        g.fill()
        rect(445, 120, 10, 115)
        rect(420, 112, 60, 18)
        break
      }
      case 'estudio-juridico': {
        for (let i = 0; i < 26; i += 1) {
          const x = 30 + i * 9
          const hh = 70 + rand() * 30
          const tones = ['#5b2a1e', '#2d3b2a', '#1f2a44', '#6b4a1a', '#3a2020']
          rect(x, 150 - hh, 7, hh, tones[i % tones.length])
          rect(x, 250 - hh, 7, hh, tones[(i + 2) % tones.length])
        }
        rect(300, 200, 170, 12)
        rect(310, 212, 10, 60)
        rect(450, 212, 10, 60)
        const lamp = g.createRadialGradient(400, 180, 2, 400, 180, 60)
        lamp.addColorStop(0, 'rgba(150,255,170,0.8)')
        lamp.addColorStop(1, 'rgba(150,255,170,0)')
        g.fillStyle = lamp
        g.fillRect(340, 120, 120, 120)
        break
      }
      case 'ecommerce': {
        rect(60, 60, 260, 6)
        const garments = ['#c2410c', '#1f2a44', '#e7c9a0', '#3f6f5a', '#8b2252', '#d9d4c8']
        for (let i = 0; i < 9; i += 1) {
          const x = 70 + i * 27
          g.fillStyle = garments[i % garments.length]
          g.beginPath()
          g.moveTo(x, 66)
          g.lineTo(x + 22, 66)
          g.lineTo(x + 26, 170 + rand() * 30)
          g.lineTo(x - 4, 170 + rand() * 30)
          g.closePath()
          g.fill()
        }
        g.fillStyle = ink
        g.beginPath()
        g.arc(410, 70, 18, 0, Math.PI * 2)
        g.fill()
        g.beginPath()
        g.moveTo(380, 95)
        g.lineTo(440, 95)
        g.lineTo(430, 210)
        g.lineTo(390, 210)
        g.closePath()
        g.fill()
        rect(406, 210, 8, 60)
        break
      }
      default: {
        // Un local esperando a alguien: vacío y con la luz encendida
        const lamp = g.createRadialGradient(w / 2, 40, 4, w / 2, 40, 220)
        lamp.addColorStop(0, 'rgba(255,255,255,0.7)')
        lamp.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = lamp
        g.fillRect(0, 0, w, h)
        g.fillStyle = ink
        g.beginPath()
        g.roundRect(w / 2 - 22, 190, 44, 70, 6)
        g.fill()
      }
    }
  })
}

export function createStreet(scene: THREE.Scene) {
  const facade = facadeTexture()
  const shellGeos: THREE.BufferGeometry[] = []
  const frameMat = new THREE.MeshStandardMaterial({ color: '#16171b', roughness: 0.5, metalness: 0.5 })
  const glassMat = new THREE.MeshStandardMaterial({ color: '#a9bdd4', transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0.4, envMapIntensity: 1.6, depthWrite: false })
  const emitters: Emitter[] = []
  const anchors: Record<string, THREE.Vector3> = {}
  const shops: { mats: { sign: THREE.MeshBasicMaterial; inside: THREE.MeshBasicMaterial }; on: THREE.Texture; off: THREE.Texture; beam: THREE.Mesh; level: number; pole?: THREE.Mesh; glare: number }[] = []
  const proxies: THREE.Mesh[] = []
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false })

  const beamMat = (color: string) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(color) }, uLevel: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vN; varying vec3 vView;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uLevel;
        varying vec2 vUv; varying vec3 vN; varying vec3 vView;
        void main() {
          float edge = 1.0 - abs(dot(vN, vView));
          float a = (0.16 + edge * 0.5) * pow(1.0 - vUv.y, 1.3) * uLevel;
          gl_FragColor = vec4(uColor * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    })

  STREET.forEach((shop, i) => {
    const cx = streetX(i)
    const W = 6.6
    const H = 4.6 + (shop.floors - 1) * 3.1
    const D = 6
    const z0 = FRONT_Z + 3.5 - D // fondo
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const g = worldBox(w, h, d)
      g.translate(x, y, z)
      const col = new THREE.Color(shop.facade)
      const arr = new Float32Array(g.getAttribute('position').count * 3)
      for (let k = 0; k < arr.length; k += 3) arr.set([col.r, col.g, col.b], k)
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
      shellGeos.push(g)
    }
    const zf = FRONT_Z + 3.5
    box(W, H, 1.6, cx, H / 2, z0 + 0.8) // fondo
    box(0.25, H, D - 1.6, cx - W / 2 + 0.125, H / 2, z0 + 1.6 + (D - 1.6) / 2)
    box(0.25, H, D - 1.6, cx + W / 2 - 0.125, H / 2, z0 + 1.6 + (D - 1.6) / 2)
    box(W, H - 3.6, D - 1.6, cx, 3.6 + (H - 3.6) / 2, z0 + 1.6 + (D - 1.6) / 2) // pisos de arriba
    box(W, 0.6, 0.2, cx, 0.3, zf - 0.1) // zócalo
    box(0.6, 3.0, 0.2, cx - W / 2 + 0.3, 0.6 + 1.5, zf - 0.1)
    box(0.6, 3.0, 0.2, cx + W / 2 - 0.3, 0.6 + 1.5, zf - 0.1)
    // Ventanas de los pisos de arriba
    for (let f = 1; f < shop.floors; f += 1) {
      for (const dx of [-1.6, 1.6]) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.3), new THREE.MeshStandardMaterial({ color: '#1a2130', roughness: 0.1, metalness: 0.8, envMapIntensity: 1.2 }))
        win.position.set(cx + dx, 4.6 + (f - 1) * 3.1 + 0.6, zf + 0.02)
        scene.add(win)
        const fr = new THREE.Mesh(new THREE.BoxGeometry(1.24, 1.44, 0.08), frameMat)
        fr.position.set(cx + dx, 4.6 + (f - 1) * 3.1 + 0.6, zf + 0.0)
        scene.add(fr)
      }
    }
    // Interior: un plano pintado al fondo del local, con muros oscuros que le dan profundidad
    const insideMat = new THREE.MeshBasicMaterial({ map: interiorTexture(shop), color: new THREE.Color(0.85, 0.85, 0.85) })
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.0), insideMat)
    inside.position.set(cx, 2.1, z0 + 1.62)
    scene.add(inside)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.0), glassMat)
    glass.position.set(cx, 2.1, zf - 0.12)
    glass.renderOrder = 2
    scene.add(glass)
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.07, 3.0, 0.08), frameMat)
    mullion.position.set(cx + 0.9, 2.1, zf - 0.08)
    scene.add(mullion)
    // Letrero
    const on = signTexture(shop.sign, true)
    const off = signTexture(shop.sign, false)
    const signMat = new THREE.MeshBasicMaterial({ map: off, color: new THREE.Color(1, 1, 1) })
    const sign = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.15, 0.16), [frameMat, frameMat, frameMat, frameMat, signMat, frameMat])
    sign.position.set(cx, 4.08, zf + 0.12)
    scene.add(sign)
    // Toldos y detalles de algunos rubros
    if (shop.id === 'gastronomia' || shop.id === 'ecommerce') {
      const aw = new THREE.Mesh(
        new THREE.PlaneGeometry(5.8, 1.1),
        new THREE.MeshStandardMaterial({ map: awningTexture(shop.id === 'gastronomia' ? '#f3e2c4' : '#ffffff', shop.id === 'gastronomia' ? '#2f5d3a' : '#c2410c'), side: THREE.DoubleSide, roughness: 0.85 }),
      )
      aw.position.set(cx, 3.42, zf + 0.55)
      aw.rotation.x = -Math.PI / 2 + 0.5
      aw.castShadow = true
      scene.add(aw)
    }
    let pole: THREE.Mesh | undefined
    if (shop.id === 'peluqueria') {
      // El poste de barbero, girando
      const tex = canvasTexture(64, 256, (g, w, h) => {
        g.fillStyle = '#ffffff'
        g.fillRect(0, 0, w, h)
        for (let k = -4; k < 12; k += 1) {
          g.fillStyle = k % 2 ? '#c8102e' : '#1d3f8f'
          g.beginPath()
          g.moveTo(0, k * 32)
          g.lineTo(w, k * 32 - 40)
          g.lineTo(w, k * 32 - 24)
          g.lineTo(0, k * 32 + 16)
          g.closePath()
          g.fill()
        }
      })
      tex.wrapT = THREE.RepeatWrapping
      pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.1, 20), new THREE.MeshBasicMaterial({ map: tex }))
      pole.position.set(cx - W / 2 + 0.45, 2.4, zf + 0.25)
      scene.add(pole)
    }
    // Haz de luz para la vista aérea
    const beam = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 30, D - 0.4, 1, 1, 1), beamMat(shop.glow))
    beam.position.set(cx, H + 15, z0 + D / 2)
    beam.visible = false
    scene.add(beam)

    const proxy = new THREE.Mesh(new THREE.PlaneGeometry(W, 5), proxyMat)
    proxy.position.set(cx, 2.5, zf + 0.3)
    proxy.name = `rubro-${shop.id}`
    scene.add(proxy)
    proxies.push(proxy)

    anchors[`rubro-${shop.id}`] = new THREE.Vector3(cx, 4.9, zf + 0.2)
    anchors[`roof-${shop.id}`] = new THREE.Vector3(cx, H + 0.6, z0 + D / 2)
    emitters.push({ pos: new THREE.Vector3(cx, 2.1, zf), color: new THREE.Color(shop.glow), size: 3.2, level: () => shops[i]?.level ?? 0 })
    // Letreros claros (caja de luz blanca) se ven bien con menos brillo: no encandilan
    const bgLum = new THREE.Color(shop.sign.kind === 'lightbox' || shop.sign.kind === 'painted' ? shop.sign.bg : '#000').getHSL({ h: 0, s: 0, l: 0 }).l
    shops.push({ mats: { sign: signMat, inside: insideMat }, on, off, beam, level: 0, pole, glare: bgLum > 0.6 ? 0.72 : 1 })
  })

  const shells = new THREE.Mesh(mergeGeometries(shellGeos), new THREE.MeshStandardMaterial({ map: facade, vertexColors: true, roughness: 0.9 }))
  shells.castShadow = true
  shells.receiveShadow = true
  scene.add(shells)

  return {
    anchors,
    proxies,
    emitters,
    update(L: Light, signs: number, beams: number, t: number, hovered: string) {
      shops.forEach((s, i) => {
        const lit = Math.min(1, Math.max(0, signs - i))
        const hover = hovered === `rubro-${STREET[i].id}` ? 1 : 0
        // De noche los letreros siempre están prendidos; de día se encienden con el scroll.
        // De noche los locales están cerrados: letrero prendido, interior en penumbra.
        // Con el scroll de la sección de rubros, cada uno «abre» y se ilumina.
        const sign = Math.max(lit, L.lamps * 0.9)
        s.level = lit * 0.8 + L.lamps * 0.25
        s.mats.sign.map = sign > 0.5 ? s.on : s.off
        s.mats.sign.color.setScalar((sign > 0.5 ? 1 + sign * 0.35 + hover * 0.3 : 0.9) * s.glare)
        s.mats.inside.color.setScalar(0.22 + lit * 0.72 + (1 - L.lamps) * 0.25 + hover * 0.25)
        const bm = s.beam.material as THREE.ShaderMaterial
        bm.uniforms.uLevel.value = beams
        s.beam.visible = beams > 0.01
        if (s.pole) {
          const tex = (s.pole.material as THREE.MeshBasicMaterial).map
          if (tex) tex.offset.y = (t * 0.25) % 1
        }
      })
    },
  }
}
