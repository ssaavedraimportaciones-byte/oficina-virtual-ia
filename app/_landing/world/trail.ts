import * as THREE from 'three'

/**
 * Estela del mouse: chispas color ámbar (las mismas de los mensajes que viajan
 * por la cuadra) que quedan detrás de la mano. Se emiten por distancia
 * recorrida, no por tiempo, para que un movimiento rápido y uno lento dibujen
 * la misma cinta; viven en el espacio de la cámara para quedarse bajo el
 * cursor aunque la cámara se mueva. Técnica de la skill «pointer-trail-emitter».
 */
export function createTrail(camera: THREE.PerspectiveCamera, opts: { count: number }) {
  const N = opts.count
  const D = 3.4
  const pos = new Float32Array(N * 3)
  const vel = new Float32Array(N * 3)
  const life = new Float32Array(N) // segundos restantes
  const maxLife = new Float32Array(N)
  const size = new Float32Array(N)
  const seed = new Float32Array(N)
  const alpha = new Float32Array(N)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  const uniforms = { uPx: { value: 1 }, uH: { value: 800 } }
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms,
    vertexShader: /* glsl */ `
      attribute float aSize; attribute float aAlpha; attribute float aSeed;
      uniform float uPx; uniform float uH;
      varying float vA; varying float vSeed;
      void main() {
        vA = aAlpha; vSeed = aSeed;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uH * uPx / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA; varying float vSeed;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float core = smoothstep(0.5, 0.0, d);
        float a = core * core * vA;
        vec3 c = mix(vec3(1.0, 0.72, 0.32), vec3(1.0, 0.93, 0.8), step(0.8, vSeed));
        gl_FragColor = vec4(c * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const points = new THREE.Points(geo, material)
  points.frustumCulled = false
  points.renderOrder = 999
  camera.add(points)

  const E = { x: 0, y: 0, lx: 0, ly: 0, acc: 0, i: 0, idle: 0, ready: false }
  const pointer = { nx: 0, ny: 0, active: false }
  let t = 0

  const spawn = (x: number, y: number, dx: number, dy: number, idle: boolean) => {
    const i = E.i // tomar el lugar antes de avanzar
    E.i = (i + 1) % N
    const hh = Math.tan((camera.fov * Math.PI) / 360) * D
    const scatter = hh * 0.13
    pos[i * 3] = x + (Math.random() - 0.5) * scatter * 0.6
    pos[i * 3 + 1] = y + (Math.random() - 0.5) * scatter * 0.6
    pos[i * 3 + 2] = -D + (Math.random() - 0.5) * 0.45
    const len = Math.hypot(dx, dy) || 1
    vel[i * 3] = (-dx / len) * 0.09 + (Math.random() - 0.5) * 0.19
    vel[i * 3 + 1] = (-dy / len) * 0.09 + (Math.random() - 0.5) * 0.19
    vel[i * 3 + 2] = 0
    maxLife[i] = idle ? 2.1 + Math.random() * 1.3 : 1.45 + Math.random() * 1.3
    life[i] = maxLife[i]
    size[i] = 0.018 + Math.random() * 0.032
    seed[i] = Math.random()
  }

  const onMove = (e: PointerEvent) => {
    pointer.nx = (e.clientX / window.innerWidth) * 2 - 1
    pointer.ny = -((e.clientY / window.innerHeight) * 2 - 1)
    pointer.active = true
  }
  const onLeave = () => {
    pointer.active = false
  }
  window.addEventListener('pointermove', onMove, { passive: true })
  document.documentElement.addEventListener('pointerleave', onLeave)

  return {
    points,
    setSize(px: number, h: number) {
      uniforms.uPx.value = px
      uniforms.uH.value = h / (2 * Math.tan((camera.fov * Math.PI) / 360))
    },
    update(dt: number) {
      t += dt
      const hh = Math.tan((camera.fov * Math.PI) / 360) * D
      const tx = pointer.nx * hh * camera.aspect
      const ty = pointer.ny * hh
      if (!E.ready && pointer.active) {
        E.x = E.lx = tx
        E.y = E.ly = ty
        E.ready = true
      }
      if (E.ready && pointer.active) {
        const k = 1 - Math.exp(-16 * dt)
        E.x += (tx - E.x) * k
        E.y += (ty - E.y) * k
        const dx = E.x - E.lx
        const dy = E.y - E.ly
        const moved = Math.hypot(dx, dy)
        const STEP = 0.03 * (hh / 1.1)
        E.acc += moved
        let guard = 0
        while (E.acc >= STEP && guard < 14) {
          guard += 1
          E.acc -= STEP
          const f = moved > 1e-6 ? Math.min(1, (guard * STEP) / moved) : 0
          spawn(E.lx + dx * f, E.ly + dy * f, dx, dy, false)
        }
        E.lx = E.x
        E.ly = E.y
        // Un respiro cuando la mano está quieta, para que no se apague del todo
        E.idle += dt
        if (moved < 1e-4 && E.idle > 0.42) {
          E.idle = 0
          spawn(E.x, E.y, 0, 1, true)
        }
      }
      const coast = 1 - 0.5 * dt
      for (let i = 0; i < N; i += 1) {
        if (life[i] <= 0) {
          alpha[i] = 0
          continue
        }
        life[i] -= dt
        const u = 1 - life[i] / maxLife[i]
        const ph = seed[i] * 6.28
        vel[i * 3] = vel[i * 3] * coast + Math.sin(t * 1.3 + ph) * 0.17 * dt
        vel[i * 3 + 1] = vel[i * 3 + 1] * coast + Math.cos(t * 1.1 + 1.7 * ph) * 0.14 * dt + 0.022 * dt
        pos[i * 3] += vel[i * 3] * dt
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt
        const fadeIn = Math.min(1, u / 0.12)
        const fadeOut = u < 0.22 ? 1 : 1 - (u - 0.22) / 0.78
        alpha[i] = Math.max(0, fadeIn * fadeOut * 0.9)
      }
      geo.attributes.position.needsUpdate = true
      geo.attributes.aAlpha.needsUpdate = true
      geo.attributes.aSize.needsUpdate = true
      geo.attributes.aSeed.needsUpdate = true
    },
    dispose() {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      camera.remove(points)
      geo.dispose()
      material.dispose()
    },
  }
}
