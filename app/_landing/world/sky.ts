import * as THREE from 'three'
import type { Light } from './palette'
import { discTexture, glowTexture, mulberry32 } from './textures'

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function makeNoise(rand: () => number) {
  const table = Array.from({ length: 256 }, () => rand())
  return (x: number) => {
    const i = Math.floor(x)
    const f = x - i
    const s = f * f * (3 - 2 * f)
    return lerp(table[i & 255], table[(i + 1) & 255], s)
  }
}

/** Cielo, estrellas, luna, sol y la cordillera de los Andes al fondo. */
export function createSky(scene: THREE.Scene, opts: { lite: boolean }) {
  const glow = glowTexture()
  const uniforms = {
    uTop: { value: new THREE.Color() },
    uMid: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, -1, 0) },
    uSunColor: { value: new THREE.Color('#ffb27a') },
    uSun: { value: 0 },
  }
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon;
      uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uSun;
      void main() {
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
        c = mix(c, uTop, smoothstep(0.18, 0.78, h));
        // Resplandor alrededor del sol, más ancho cerca del horizonte
        float d = max(0.0, dot(normalize(vDir), normalize(uSunDir)));
        c += uSunColor * (pow(d, 18.0) * 0.55 + pow(d, 4.0) * 0.18) * uSun;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 20), material)
  dome.renderOrder = -10
  scene.add(dome)

  // Estrellas que titilan
  const rand = mulberry32(7)
  const starCount = opts.lite ? 700 : 1500
  const starPos = new Float32Array(starCount * 3)
  const starSeed = new Float32Array(starCount)
  for (let i = 0; i < starCount; i += 1) {
    const theta = rand() * Math.PI * 2
    const phi = Math.acos(0.06 + rand() * 0.94)
    starPos.set([1500 * Math.sin(phi) * Math.cos(theta), 1500 * Math.cos(phi), 1500 * Math.sin(phi) * Math.sin(theta)], i * 3)
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
          gl_PointSize = (1.1 + aSeed * 2.1) * uPx;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(0.9, 0.93, 1.0, smoothstep(0.5, 0.0, d) * vA * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }),
  )
  scene.add(stars)

  // Luna
  const disc = discTexture()
  const moon = new THREE.Group()
  const moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc, color: new THREE.Color(1.4, 1.36, 1.26), fog: false, depthWrite: false, transparent: true }))
  moonDisc.scale.set(76, 76, 1)
  const moonHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow, color: '#9fb4ff', transparent: true, opacity: 0.4, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
  )
  moonHalo.scale.set(380, 380, 1)
  moon.add(moonHalo, moonDisc)
  scene.add(moon)

  // Sol
  const sun = new THREE.Group()
  const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc, color: new THREE.Color('#ffd7a0').multiplyScalar(2.4), fog: false, depthWrite: false, transparent: true }))
  sunDisc.scale.set(54, 54, 1)
  const sunHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow, color: '#ff9a4d', transparent: true, opacity: 0.7, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
  )
  sunHalo.scale.set(640, 400, 1)
  sun.add(sunHalo, sunDisc)
  scene.add(sun)

  // Cordillera: cuatro planos, el más lejano con nieve
  const ridges: THREE.Mesh[] = []
  const defs = [
    { z: -340, base: 44, amp: 100, freq: 0.0082, color: '#2a3550', snow: '#b5c0dc', seed: 11 },
    { z: -260, base: 30, amp: 72, freq: 0.0115, color: '#1d2740', snow: '#93a1c4', seed: 23 },
    { z: -190, base: 17, amp: 48, freq: 0.017, color: '#141c32', snow: '#6a779c', seed: 37 },
    { z: -130, base: 8, amp: 28, freq: 0.024, color: '#0d1426', snow: '#4a567a', seed: 41 },
  ]
  for (const def of defs) {
    const noise = makeNoise(mulberry32(def.seed))
    const cols = 300
    const positions = new Float32Array((cols + 1) * 6)
    const colors = new Float32Array((cols + 1) * 6)
    const base = new THREE.Color(def.color)
    const snow = new THREE.Color(def.snow)
    const tmp = new THREE.Color()
    for (let i = 0; i <= cols; i += 1) {
      const x = (i / cols - 0.5) * 1700
      const n = noise(x * def.freq) * 0.55 + noise(x * def.freq * 2.3 + 9) * 0.3 + noise(x * def.freq * 5.1 + 21) * 0.15
      const h = def.base + Math.pow(1 - Math.abs(2 * n - 1), 1.7) * def.amp
      positions.set([x, -40, def.z, x, h, def.z], i * 6)
      tmp.copy(base).lerp(snow, smooth(def.base + def.amp * 0.4, def.base + def.amp * 0.85, h) * 0.9)
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

  const sunDir = new THREE.Vector3()

  return {
    uniforms,
    material,
    sunDir,
    update(L: Light, t: number, u: number, camera: THREE.Camera) {
      uniforms.uTop.value.copy(L.skyTop)
      uniforms.uMid.value.copy(L.skyMid)
      uniforms.uHorizon.value.copy(L.skyHorizon)
      starUniforms.uTime.value = t
      starUniforms.uOpacity.value = L.stars
      stars.visible = L.stars > 0.01

      // El sol cruza de izquierda (este, la cordillera) hacia la derecha a lo largo del día.
      const h = L.sunHeight
      const sunX = lerp(90, -60, smooth(5, 9.5, u))
      sun.position.set(sunX, lerp(-60, 260, Math.max(0, h)), -460)
      sun.visible = h > -0.3
      sunHalo.material.opacity = 0.75 * Math.max(0, 1 - Math.max(0, h) * 0.6) * smooth(-0.3, 0.1, h)
      sunDisc.material.opacity = smooth(-0.3, 0.05, h)
      sunDir.copy(sun.position).normalize()
      uniforms.uSunDir.value.copy(sunDir)
      uniforms.uSunColor.value.copy(L.key)
      uniforms.uSun.value = smooth(-0.35, 0.2, h)

      moon.visible = L.moon > 0.01
      moon.position.set(lerp(-110, -200, smooth(0, 5, u)), lerp(200, 70, smooth(0, 5, u)), -440)
      // A nivel de calle la luna queda al borde del cuadro: el halo se recoge para no lavar la parte de arriba.
      const street = smooth(0.5, 1.4, u) * (1 - smooth(4.4, 5, u))
      moonHalo.material.opacity = 0.4 * L.moon * (1 - 0.65 * street)
      moonHalo.scale.setScalar(380 - 150 * street)
      moonDisc.material.opacity = L.moon
      ridges.forEach((r, i) => (r.material as THREE.MeshBasicMaterial).color.copy(L.ridge).multiplyScalar(1 - i * 0.05))
      dome.position.copy(camera.position)
      stars.position.copy(camera.position)
    },
    setPixelRatio(px: number) {
      starUniforms.uPx.value = px
    },
  }
}
