import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import type { bus as Bus } from '../bus'
import { ANA, OWNER, createCity, type Emitter } from './city'
import { lightAt } from './palette'
import { sampleRig, timeOfDay } from './rig'
import { createShop } from './shop'
import { createSky } from './sky'
import { createStory } from './story'
import { createStreet } from './street'
import { glowTexture } from './textures'
import { createTrail } from './trail'

/**
 * El mundo de la landing: una cuadra de Santiago y la calle que sigue, de la
 * noche al amanecer, al día y de vuelta a la noche. Un solo renderer y una
 * sola escena para toda la página; el scroll (vía `bus`) decide el plano.
 */
export async function createWorld(canvas: HTMLCanvasElement, bus: typeof Bus): Promise<() => void> {
  const small = window.matchMedia('(max-width: 820px)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  const lite = small || coarse

  // Los letreros se pintan con las fuentes de la página: esperarlas.
  try {
    await Promise.all([
      document.fonts.load('800 100px "Archivo Variable"'),
      document.fonts.load('600 100px "Fraunces Variable"'),
      document.fonts.load('italic 600 100px "Fraunces Variable"'),
    ])
  } catch {
    // Sin las fuentes, los letreros usan las del sistema.
  }
  bus.load = 0.2

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, powerPreference: 'high-performance' })
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = !lite
  renderer.shadowMap.type = THREE.PCFShadowMap

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2('#0a1122', 0.005)
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2600)
  scene.add(camera)

  // --- El mundo ----------------------------------------------------------------
  const sky = createSky(scene, { lite })
  const city = createCity(scene, { lite, reserved: [{ x: ANA.x, y: ANA.y }, { x: OWNER.x, y: OWNER.y }] })
  const shop = createShop(scene)
  const story = createStory(scene, shop.door)
  const street = createStreet(scene)
  bus.load = 0.5

  const hemi = new THREE.HemisphereLight('#4d6aa8', '#1a1410', 0.55)
  scene.add(hemi)
  const key = new THREE.DirectionalLight('#8fa6e8', 0.5)
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.left = -38
  key.shadow.camera.right = 38
  key.shadow.camera.top = 38
  key.shadow.camera.bottom = -38
  key.shadow.camera.near = 1
  key.shadow.camera.far = 220
  key.shadow.bias = -0.0005
  key.shadow.normalBias = 0.04
  scene.add(key, key.target)

  // Mapa de entorno: lo que reflejan vidrios, autos y charcos. Se regenera cuando cambia la hora.
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envScene = new THREE.Scene()
  const envDome = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), sky.material)
  envScene.add(envDome)
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(60, 32), new THREE.MeshBasicMaterial({ color: '#0b0d12' }))
  envGround.rotation.x = -Math.PI / 2
  envGround.position.y = -2
  envScene.add(envGround)
  const envLamps: THREE.Mesh[] = []
  for (let i = 0; i < 10; i += 1) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc27a').multiplyScalar(4) }))
    const a = (i / 10) * Math.PI * 2
    m.position.set(Math.cos(a) * 40, 6, Math.sin(a) * 40)
    envScene.add(m)
    envLamps.push(m)
  }
  let envTod = -99
  let envRT: THREE.WebGLRenderTarget | null = null
  const updateEnv = (tod: number, lamps: number) => {
    if (Math.abs(tod - envTod) < 0.12) return
    envTod = tod
    envLamps.forEach((m) => (m.visible = lamps > 0.1))
    const rt = pmrem.fromScene(envScene, 0.02, 0.1, 200)
    envRT?.dispose()
    envRT = rt
    scene.environment = rt.texture
  }

  // --- Lluvia ----------------------------------------------------------------------
  const dropCount = lite ? 1400 : 3200
  const dropPos = new Float32Array(dropCount * 6)
  const dropTip = new Float32Array(dropCount * 2)
  const dropRand = new Float32Array(dropCount * 2)
  for (let i = 0; i < dropCount; i += 1) {
    const x = (Math.random() - 0.5) * 70
    const y = Math.random() * 26
    const z = -12 + Math.random() * 46
    const r = Math.random()
    dropPos.set([x, y, z, x, y, z], i * 6)
    dropTip.set([0, 1], i * 2)
    dropRand.set([r, r], i * 2)
  }
  const rainGeo = new THREE.BufferGeometry()
  rainGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3))
  rainGeo.setAttribute('aTip', new THREE.BufferAttribute(dropTip, 1))
  rainGeo.setAttribute('aRand', new THREE.BufferAttribute(dropRand, 1))
  const rainUniforms = { uTime: { value: 0 }, uIntensity: { value: 0 }, uH: { value: 26 }, uOrigin: { value: new THREE.Vector3() } }
  const rain = new THREE.LineSegments(
    rainGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: rainUniforms,
      vertexShader: /* glsl */ `
        attribute float aTip; attribute float aRand;
        uniform float uTime; uniform float uIntensity; uniform float uH; uniform vec3 uOrigin;
        varying float vA;
        void main() {
          float y = mod(position.y - uTime * (16.0 + aRand * 8.0), uH);
          vec3 p = vec3(position.x + uOrigin.x + y * 0.07, y + aTip * 0.9, position.z);
          vA = step(aRand, uIntensity) * (0.12 + 0.28 * aRand);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() { gl_FragColor = vec4(0.72, 0.8, 1.0, vA);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }),
  )
  rain.frustumCulled = false
  scene.add(rain)

  // --- Pelusas del plátano oriental: en primavera flotan por todo Santiago ---------
  const fluffCount = lite ? 140 : 320
  const fluffPos = new Float32Array(fluffCount * 3)
  const fluffSeed = new Float32Array(fluffCount)
  for (let i = 0; i < fluffCount; i += 1) {
    fluffPos.set([(Math.random() - 0.5) * 40, Math.random() * 12, (Math.random() - 0.5) * 30], i * 3)
    fluffSeed[i] = Math.random()
  }
  const fluffGeo = new THREE.BufferGeometry()
  fluffGeo.setAttribute('position', new THREE.BufferAttribute(fluffPos, 3))
  fluffGeo.setAttribute('aSeed', new THREE.BufferAttribute(fluffSeed, 1))
  const fluffUniforms = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uPx: { value: 1 }, uLight: { value: 1 }, uColor: { value: new THREE.Color('#fff2d6') } }
  const fluff = new THREE.Points(
    fluffGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: fluffUniforms,
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime; uniform vec3 uCenter; uniform float uPx;
        varying float vA;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.3 + aSeed * 20.0) * 1.2 + uTime * 0.25;
          p.y += sin(uTime * 0.45 + aSeed * 13.0) * 0.6 - uTime * 0.04;
          p.z += cos(uTime * 0.27 + aSeed * 9.0) * 1.0;
          // Caja que acompaña a la cámara: siempre hay pelusas cerca
          p = uCenter + mod(p - uCenter + vec3(20.0, 6.0, 15.0), vec3(40.0, 12.0, 30.0)) - vec3(20.0, 6.0, 15.0);
          p.y = max(p.y, 0.3);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = smoothstep(32.0, 6.0, -mv.z) * (0.35 + aSeed * 0.5);
          gl_PointSize = (1.4 + aSeed * 2.2) * uPx * (10.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uLight; uniform vec3 uColor; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(uColor, smoothstep(0.5, 0.1, d) * vA * uLight);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }),
  )
  fluff.frustumCulled = false
  scene.add(fluff)

  // --- Reflejos en la calle mojada --------------------------------------------------
  // Cada luz tiene un reflejo estirado sobre el asfalto: se ubica donde el rayo de la
  // cámara hacia la luz espejada (bajo el suelo) corta la calle.
  const glow = glowTexture()
  const emitters: Emitter[] = [...city.emitters, ...shop.emitters, ...story.emitters, ...street.emitters]
  const reflections = emitters.map((e) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: e.color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
    s.renderOrder = 1
    scene.add(s)
    return { e, s }
  })
  const mirrored = new THREE.Vector3()
  const rayDir = new THREE.Vector3()
  const updateReflections = (wet: number) => {
    for (const { e, s } of reflections) {
      const level = e.level() * wet
      if (level < 0.02) {
        s.visible = false
        continue
      }
      mirrored.set(e.pos.x, -e.pos.y, e.pos.z)
      rayDir.subVectors(mirrored, camera.position)
      const k = (0.03 - camera.position.y) / rayDir.y
      if (!(k > 0) || k > 1) {
        s.visible = false
        continue
      }
      s.visible = true
      s.position.copy(camera.position).addScaledVector(rayDir, k)
      const ratio = k // la distancia al punto en el suelo vs. a la luz espejada
      s.scale.set(e.size * ratio * 0.9, e.size * ratio * 2.8, 1)
      s.material.opacity = Math.min(0.75, level * 0.55)
    }
  }

  // --- Estela del mouse --------------------------------------------------------------
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const trail = fine && !calm ? createTrail(camera, { count: 190 }) : null

  // --- Anclas del DOM: rótulos y burbujas que siguen a la escena ------------------
  const anchorPoints: Record<string, THREE.Vector3> = { ...story.labels, ...street.anchors }
  const anchorEls = Array.from(document.querySelectorAll<HTMLElement>('[data-anchor]'))
  const flightEls = new Map(Array.from(document.querySelectorAll<HTMLElement>('[data-flight]')).map((el) => [el.dataset.flight!, el]))
  const proj = new THREE.Vector3()
  const setAnchor = (el: HTMLElement, p: THREE.Vector3, hideOff: boolean) => {
    proj.copy(p).project(camera)
    const x = (proj.x * 0.5 + 0.5) * width
    const y = (-proj.y * 0.5 + 0.5) * height
    el.style.setProperty('--ax', `${x.toFixed(1)}px`)
    el.style.setProperty('--ay', `${y.toFixed(1)}px`)
    if (hideOff) {
      const keep = el.dataset.keepout
      // Los rótulos con zona prohibida tampoco se dejan cortar contra el borde
      let off = proj.z > 1 || Math.abs(proj.x) > (keep ? 0.84 : 0.98) || Math.abs(proj.y) > 0.92
      // …ni pisan la columna de texto (diagramación ancha, ver landing.css)
      if (!off && keep && width >= 900 && (keep === 'right' ? x > width * 0.5 : x < width * 0.5)) off = true
      const state = off ? 'true' : 'false'
      if (el.dataset.off !== state) el.dataset.off = state
    }
  }

  // --- Mouse sobre la escena ------------------------------------------------------------
  const raycaster = new THREE.Raycaster()
  const proxies = [...story.proxies, ...street.proxies]
  const pointer = { x: 0, y: 0, nx: 0, ny: 0, sx: 0, sy: 0, inside: false }
  const onPointer = (e: PointerEvent) => {
    pointer.nx = (e.clientX / window.innerWidth) * 2 - 1
    pointer.ny = -((e.clientY / window.innerHeight) * 2 - 1)
    pointer.x = pointer.nx
    pointer.y = -pointer.ny
    pointer.inside = true
  }
  const onLeave = () => {
    pointer.inside = false
  }
  if (fine) {
    window.addEventListener('pointermove', onPointer, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
  }

  // --- Post-proceso -----------------------------------------------------------------
  let composer: EffectComposer | null = null
  let bloom: UnrealBloomPass | null = null
  if (!lite) {
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.7, 0.86)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
  }

  let width = 1
  let height = 1
  // En desarrollo se puede fijar la calidad (para capturas en un navegador sin GPU).
  const dev = process.env.NODE_ENV !== 'production' ? (window as unknown as { __zvQuality?: number; __zvShadows?: boolean }) : {}
  let quality = dev.__zvQuality ?? 2
  if (dev.__zvShadows === false) renderer.shadowMap.enabled = false
  let tall = false
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
    tall = camera.aspect < 0.9
    camera.updateProjectionMatrix()
    sky.setPixelRatio(dpr)
    fluffUniforms.uPx.value = dpr
    trail?.setSize(dpr, height)
  }
  resize()
  window.addEventListener('resize', resize)

  // Compilar los shaders antes de mostrar nada: evita el tirón del primer scroll.
  renderer.compile(scene, camera)
  bus.load = 0.8

  // --- Bucle ----------------------------------------------------------------------
  const target = () => (bus.post > 0 ? bus.post : bus.hero < 1 ? bus.hero : 1 + bus.cam)
  let us = target()
  let slow = 16
  let frames = 0
  let heavy = 0
  let raf = 0
  let last = performance.now()
  let running = false
  const clock0 = last
  const pos = new THREE.Vector3()
  const tgt = new THREE.Vector3()
  const moonDir = new THREE.Vector3(-0.45, 0.8, -0.4).normalize()
  let hoverTick = 0
  let firstFrame = true

  const frame = (now: number) => {
    raf = 0
    if (!running) return
    const rawDt = (now - last) / 1000
    const dt = Math.min(0.05, rawDt)
    last = now
    const t = (now - clock0) / 1000

    // Para grabar el recorrido cuadro a cuadro en desarrollo: la cámara salta al plano exacto.
    const snap = process.env.NODE_ENV !== 'production' && (window as unknown as { __zvSnap?: boolean }).__zvSnap
    us = snap ? target() : us + (target() - us) * (1 - Math.exp(-dt * 3.2))
    pointer.sx += (pointer.nx - pointer.sx) * (1 - Math.exp(-dt * 2.4))
    pointer.sy += (pointer.ny - pointer.sy) * (1 - Math.exp(-dt * 2.4))

    const fov = sampleRig(us, tall, pos, tgt)
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
      trail?.setSize(renderer.getPixelRatio(), height)
    }
    // Respiración de cámara y parallax con el mouse (no cambia el plano, solo lo hace vivo)
    pos.x += Math.sin(t * 0.21) * 0.07 + pointer.sx * 0.32
    pos.y += Math.sin(t * 0.17) * 0.04 + pointer.sy * 0.16
    tgt.x += pointer.sx * 0.5
    tgt.y += pointer.sy * 0.25
    camera.position.copy(pos)
    camera.lookAt(tgt)
    camera.updateMatrixWorld()

    const tod = timeOfDay(us, bus.dawn)
    const L = lightAt(tod)
    renderer.toneMappingExposure = L.exposure
    const fog = scene.fog as THREE.FogExp2
    fog.color.copy(L.fog)
    fog.density = L.fogDensity + bus.rain * 0.0035
    renderer.setClearColor(L.fog)
    hemi.color.copy(L.hemiSky)
    hemi.groundColor.copy(L.hemiGround)
    hemi.intensity = L.hemi

    sky.update(L, t, us, camera)
    // Luz principal: el sol si está arriba; si no, la luna.
    const sunUp = L.sunHeight > 0
    key.color.copy(L.key)
    key.intensity = L.keyIntensity
    key.position.copy(tgt).addScaledVector(sunUp ? sky.sunDir : moonDir, 90)
    key.target.position.copy(tgt)
    key.castShadow = renderer.shadowMap.enabled && quality >= 2 && sunUp && L.keyIntensity > 0.8

    city.update(L, t)
    shop.update(L, bus.shop, bus.sold, t)
    story.update(bus, t, bus.hover)
    street.update(L, bus.signs, bus.beams, t, bus.hover)
    updateEnv(tod, L.lamps)
    updateReflections(L.wet)

    rainUniforms.uTime.value = t
    rainUniforms.uIntensity.value = bus.rain
    rainUniforms.uOrigin.value.set(tgt.x, 0, 0)
    rain.visible = bus.rain > 0.01
    fluffUniforms.uTime.value = t
    fluffUniforms.uCenter.value.copy(tgt).lerp(camera.position, 0.6)
    fluffUniforms.uLight.value = 0.35 + Math.max(L.hemi - 0.5, 0) * 0.9 + L.lamps * 0.25
    trail?.update(dt)

    // DOM que sigue a la escena
    for (const el of anchorEls) {
      const p = anchorPoints[el.dataset.anchor!]
      if (p) setAnchor(el, p, true)
    }
    for (const f of story.flights) {
      const el = flightEls.get(f.id)
      if (el) setAnchor(el, f.curve.getPoint(Math.min(1, Math.max(0, bus.fl[f.id] ?? 0))), false)
    }

    // Qué hay bajo el mouse (cada tres cuadros alcanza)
    hoverTick += 1
    if (fine && hoverTick % 3 === 0) {
      let hit = ''
      if (pointer.inside) {
        raycaster.setFromCamera(new THREE.Vector2(pointer.nx, pointer.ny), camera)
        const hits = raycaster.intersectObjects(proxies, false)
        if (hits.length) hit = hits[0].object.name
      }
      if (bus.hover !== hit) bus.hover = hit
    }

    if (bloom) bloom.strength = 0.42 - Math.min(0.15, Math.max(0, L.sunHeight) * 0.15)

    // Gobernador de calidad: si el equipo no da la talla, primero se apagan sombras y brillo,
    // después baja la resolución. Reacciona rápido a cuadros muy lentos y despacio a los apenas lentos.
    if (rawDt < 0.2) {
      slow = slow * 0.95 + rawDt * 1000 * 0.05
      frames += 1
      heavy = 0
    } else if (rawDt < 2.5 && !document.hidden) {
      heavy += 1
    }
    if (dev.__zvQuality === undefined && quality > 0 && ((frames > 90 && slow > 38) || heavy >= 4)) {
      quality -= 1
      frames = 0
      heavy = 0
      slow = 16
      if (quality < 2) renderer.shadowMap.enabled = false
      resize()
    }
    if (composer && quality >= 2) composer.render()
    else renderer.render(scene, camera)
    if (firstFrame) {
      firstFrame = false
      bus.load = 1
      canvas.dataset.ready = 'true'
      document.documentElement.dataset.world = 'on'
    }
    raf = requestAnimationFrame(frame)
  }

  const start = () => {
    if (running || document.hidden) return
    running = true
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
  const stop = () => {
    running = false
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }
  const onVisibility = () => (document.hidden ? stop() : start())
  document.addEventListener('visibilitychange', onVisibility)
  const onLost = (e: Event) => {
    e.preventDefault()
    stop()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  start()

  return () => {
    stop()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('resize', resize)
    window.removeEventListener('pointermove', onPointer)
    document.documentElement.removeEventListener('pointerleave', onLeave)
    canvas.removeEventListener('webglcontextlost', onLost)
    trail?.dispose()
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      mesh.geometry?.dispose?.()
      const mat = mesh.material as (THREE.Material & { map?: THREE.Texture | null }) | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else {
        mat?.map?.dispose()
        mat?.dispose?.()
      }
    })
    envRT?.dispose()
    pmrem.dispose()
    composer?.dispose()
    renderer.dispose()
    delete canvas.dataset.ready
    delete document.documentElement.dataset.world
  }
}
