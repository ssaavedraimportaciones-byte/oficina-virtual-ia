import { bus } from './bus'
import { CHAPTERS, FLIGHTS, RAIL, STREET } from './data'
import { CHAPTER_UNITS, buildNight } from './Stage'

/**
 * El director de scroll de toda la página: un solo scroll suave (Lenis) y
 * GSAP ScrollTrigger. Traduce la posición del documento en el plano de cámara
 * del mundo 3D (`bus`), marca la sección activa en la navegación y el riel,
 * reparte los primeros planos y revela los textos. La posición del scroll es
 * siempre la fuente de verdad: hacia adelante, hacia atrás o con un salto.
 */
export async function initMotion(): Promise<() => void> {
  const [{ default: gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('lenis')])
  gsap.registerPlugin(ScrollTrigger)
  ScrollTrigger.config({ ignoreMobileResize: true })
  if (document.fonts?.ready) await document.fonts.ready

  const root = document.documentElement
  const lenis = new Lenis({ lerp: 0.085 })
  lenis.on('scroll', ScrollTrigger.update)
  const tick = (time: number) => lenis.raf(time * 1000)
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)

  const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)
  const $$ = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel))

  const stage = $<HTMLElement>('[data-stage]')
  const hero = $<HTMLElement>('[data-hero]')
  const heroContent = $<HTMLElement>('[data-hero-content]')
  const sections = Object.fromEntries(['rubros', 'negocios', 'limites', 'integraciones', 'empieza', 'final'].map((id) => [id, document.getElementById(id)])) as Record<string, HTMLElement | null>
  const navLinks = $$<HTMLElement>('[data-nav]')
  const railLinks = $$<HTMLElement>('[data-rail]')
  const fgLayers = $$<HTMLElement>('[data-fg]')
  const indexRows = $$<HTMLElement>('[data-rubro]')
  const tags = $$<HTMLElement>('[data-tag]')
  const shades = $$<HTMLElement>('[data-shade]')
  const shadeLast = shades.map(() => -1)

  let ctx: ReturnType<typeof gsap.context> | undefined
  let night: ReturnType<typeof buildNight> | undefined
  let builtWidth = 0

  // Medidas (en px de scroll), se recalculan en cada refresh
  const M = {
    vh: window.innerHeight,
    heroEnd: 0,
    stageStart: 0,
    stageEnd: 0,
    keys: [] as [number, number][],
    top: {} as Record<string, number>,
    h: {} as Record<string, number>,
  }
  const absTop = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY

  const measure = () => {
    M.vh = window.innerHeight
    M.heroEnd = hero ? absTop(hero) + hero.offsetHeight - M.vh : 0
    const st = night?.scrollTrigger
    M.stageStart = st ? st.start : M.heroEnd
    M.stageEnd = st ? st.end : M.heroEnd
    for (const [id, el] of Object.entries(sections)) {
      if (!el) continue
      M.top[id] = absTop(el)
      M.h[id] = el.offsetHeight
    }
    const center = (id: string) => M.top[id] + Math.max(0, M.h[id] - M.vh) / 2
    M.keys = [
      [M.stageEnd, 5],
      [M.top.rubros, 6],
      [M.top.rubros + Math.max(1, M.h.rubros - M.vh), 6.9],
      [M.top.negocios, 7],
      [M.top.negocios + Math.max(1, M.h.negocios - M.vh), 7],
      [center('limites'), 8],
      [center('integraciones'), 8.5],
      [center('empieza'), 9],
      [M.top.final, 10],
    ]
  }

  const postFor = (y: number) => {
    if (y <= M.stageEnd + 1) return 0
    const k = M.keys
    for (let i = 0; i < k.length - 1; i += 1) {
      const [y0, u0] = k[i]
      const [y1, u1] = k[i + 1]
      if (y <= y1) return y1 > y0 ? u0 + ((u1 - u0) * (y - y0)) / (y1 - y0) : u1
    }
    return 10
  }

  // Peso de cada sombra de legibilidad: entra mientras la sección llega y se va con ella
  const ramp = (y: number, a: number, b: number) => Math.min(1, Math.max(0, (y - a) / Math.max(1, b - a)))
  const band = (y: number, from: number, to: number, fade: number) => Math.min(ramp(y, from - fade, from), 1 - ramp(y, to, to + fade))
  const shadeWeight = (id: string, y: number) => {
    if (id === 'noche') return band(y, M.stageStart, M.stageEnd, M.vh * 0.5)
    if (M.top[id] === undefined) return 0
    return band(y, M.top[id], M.top[id] + Math.max(0, M.h[id] - M.vh), M.vh * 0.6)
  }

  let lastSection = ''
  let lastChapter = ''
  const conduct = () => {
    const y = window.scrollY
    bus.post = postFor(y)

    shades.forEach((el, i) => {
      const w = Math.round(shadeWeight(el.dataset.shade ?? '', y) * 1000) / 1000
      if (w === shadeLast[i]) return
      shadeLast[i] = w
      el.style.opacity = String(w)
      el.style.visibility = w > 0 ? 'visible' : 'hidden'
    })

    // Sección activa: la que ocupa el centro de la pantalla
    const mid = y + M.vh * 0.5
    let section = 'inicio'
    if (mid >= M.stageStart && y < M.stageEnd + M.vh * 0.5) section = 'noche'
    for (const id of ['rubros', 'negocios', 'limites', 'integraciones', 'empieza', 'final']) if (M.top[id] !== undefined && mid >= M.top[id]) section = id
    if (y < M.stageStart - M.vh * 0.5) section = 'inicio'

    let chapter = section
    if (section === 'noche') {
      const p = Math.min(0.999, Math.max(0, (y - M.stageStart) / Math.max(1, M.stageEnd - M.stageStart)))
      chapter = CHAPTERS[Math.floor(p * CHAPTERS.length)].id
    }
    if (section !== lastSection) {
      lastSection = section
      root.dataset.section = section
      navLinks.forEach((a) => a.toggleAttribute('aria-current', a.dataset.nav === section))
      // Primeros planos: entran los de la sección; los demás se retiran difuminándose
      fgLayers.forEach((l) => {
        const owners = (l.dataset.owners ?? '').split(' ')
        const on = owners.includes(section)
        const state = on ? 'on' : l.dataset.state === 'on' ? 'out' : l.dataset.state === 'out' ? 'out' : 'off'
        l.dataset.state = state
      })
    }
    if (chapter !== lastChapter) {
      lastChapter = chapter
      railLinks.forEach((a) => {
        const on = a.dataset.rail === chapter
        a.toggleAttribute('aria-current', on)
        a.dataset.state = on ? 'on' : 'off'
      })
    }
  }

  const build = () => {
    builtWidth = window.innerWidth
    const lite = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches
    // Cada armado parte del estado inicial: los tweens registran sus valores desde acá.
    Object.assign(bus, { hero: 0, cam: 0, post: 0, shop: 0.3, owner: 1, ownerPhone: 0, anaPhone: 0, sold: 0, dawn: 0, rain: 0, signs: 0, beams: 0 })
    FLIGHTS.forEach((f) => (bus.fl[f.id] = 0))

    ctx = gsap.context(() => {
      // Portada: la cámara baja del cielo a la calle y el título se va
      if (hero) {
        ScrollTrigger.create({
          trigger: hero,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (self) => {
            bus.hero = self.progress
          },
        })
        if (heroContent) {
          // Se anima cada bloque por separado: así la palabra gigante queda bajo los primeros planos y el texto encima.
          const blocks = heroContent.querySelectorAll('.zv-hero-grid, .zv-facts, .zv-cue')
          // El texto se retira antes de que la cámara toque la calle: el aterrizaje queda limpio
          gsap.to(blocks, { opacity: 0, y: -80, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: '40% top', scrub: true } })
          const giant = document.querySelector('[data-giant]')
          if (giant) {
            // Sube con parallax durante toda la portada, pero ya se apagó cuando llega la noche
            gsap.fromTo(giant, { yPercent: 0 }, { yPercent: 40, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } })
            gsap.fromTo(giant, { autoAlpha: 1 }, { autoAlpha: 0, ease: 'power1.in', scrollTrigger: { trigger: hero, start: 'top top', end: '46% top', scrub: true } })
          }
        }
      }

      // La noche
      if (stage) night = buildNight(gsap, stage, lite)

      // Calle de rubros: los letreros se encienden con el avance
      if (sections.rubros) {
        ScrollTrigger.create({
          trigger: sections.rubros,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (self) => {
            // Misma curva que la cámara entre los planos 6 y 6.9 (rig.ts): el letrero activo no se le escapa
            const p = self.progress
            bus.signs = p * p * (3 - 2 * p) * (STREET.length + 0.6)
            const active = Math.min(STREET.length - 1, Math.floor(bus.signs - 0.35))
            indexRows.forEach((r) => {
              const i = Number(r.dataset.rubro)
              const state = i === active ? 'on' : i < active ? 'past' : 'next'
              if (r.dataset.state !== state) r.dataset.state = state
            })
            tags.forEach((t) => {
              const state = Number(t.dataset.tag) === active ? 'on' : 'off'
              if (t.dataset.state !== state) t.dataset.state = state
            })
          },
          onLeave: () => tags.forEach((t) => (t.dataset.state = 'off')),
          onLeaveBack: () => {
            bus.signs = 0
            tags.forEach((t) => (t.dataset.state = 'off'))
          },
        })
      }
      // Vista aérea: cada negocio en su propio haz de luz
      if (sections.negocios) {
        ScrollTrigger.create({
          trigger: sections.negocios,
          start: 'top 60%',
          end: 'bottom bottom',
          onUpdate: (self) => {
            const p = self.progress
            const rise = Math.min(1, Math.max(0, (p - 0.1) / 0.35))
            const fall = Math.min(1, Math.max(0, (1 - p) / 0.12))
            bus.beams = rise * fall
            root.dataset.roofs = p > 0.2 && p < 0.9 ? 'on' : 'off'
          },
          onLeave: () => {
            bus.beams = 0
            root.dataset.roofs = 'off'
          },
          onLeaveBack: () => {
            bus.beams = 0
            root.dataset.roofs = 'off'
          },
        })
      }

      // Al soltarse una sección fija, su bloque se va fundiendo mientras sube: no se mete bajo la navegación
      for (const id of ['rubros', 'negocios']) {
        const sec = sections[id]
        const col = sec?.querySelector('.zv-sticky > .zv-col')
        if (sec && col) gsap.to(col, { autoAlpha: 0, y: -48, ease: 'power1.out', scrollTrigger: { trigger: sec, start: 'bottom bottom', end: 'bottom 70%', scrub: true } })
      }

      // Revelado de textos: palabra por palabra el título, y después cada pieza
      $$<HTMLElement>('[data-reveal]').forEach((block) => {
        if (block.closest('[data-stage]')) return
        const words = Array.from(block.querySelectorAll('.zv-w'))
        const items = Array.from(block.querySelectorAll('[data-reveal-item]'))
        const tl = gsap.timeline({ paused: true })
        if (words.length) tl.fromTo(words, { yPercent: 110 }, { yPercent: 0, duration: 0.95, stagger: 0.072, ease: 'power4.out' }, 0)
        if (items.length) tl.fromTo(items, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out' }, words.length ? 0.25 : 0)
        ScrollTrigger.create({
          trigger: block,
          start: 'top 84%',
          onEnter: () => tl.play(),
          onLeaveBack: () => tl.reverse(),
        })
      })

      // El conductor: corre en cada scroll, después de los demás disparadores
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: conduct,
        onRefresh: () => {
          measure()
          conduct()
        },
      })
    })
  }

  build()
  ScrollTrigger.addEventListener('refresh', measure)
  ScrollTrigger.refresh()
  measure()
  conduct()

  // Atajo para el riel y los enlaces internos: lleva a cada capítulo con el scroll suave
  const positionFor = (id: string) => {
    const night = CHAPTERS.findIndex((c) => c.id === id)
    if (night >= 0) {
      const span = M.stageEnd - M.stageStart
      return M.stageStart + (span * (night * CHAPTER_UNITS + 6.5)) / (CHAPTER_UNITS * CHAPTERS.length)
    }
    if (id === 'inicio') return 0
    if (id === 'noche') return M.stageStart + 2
    if (id === 'rubros') return M.top.rubros + M.vh * 0.2
    if (id === 'negocios') return M.top.negocios + Math.max(0, M.h.negocios - M.vh) * 0.55
    if (id === 'final') return M.top.final
    if (M.top[id] !== undefined) return M.top[id] + Math.max(0, M.h[id] - M.vh) / 2
    return null
  }
  window.zvGoTo = (id: string) => {
    const y = positionFor(id)
    if (y === null) return
    const dist = Math.abs(y - window.scrollY)
    lenis.scrollTo(y, { duration: Math.min(3.2, 1 + dist / (M.vh * 6)), easing: (t: number) => 1 - Math.pow(1 - t, 4) })
  }
  // Los enlaces de la navegación (#noche, #rubros…) usan el mismo atajo
  const onAnchor = (e: MouseEvent) => {
    const a = (e.target as HTMLElement)?.closest<HTMLAnchorElement>('a[href^="#"]')
    if (!a) return
    const id = a.getAttribute('href')!.slice(1)
    if (id === 'contenido') return
    if (RAIL.some((r) => r.id === id) || id === 'noche' || sections[id]) {
      e.preventDefault()
      window.zvGoTo?.(id)
    }
  }
  document.addEventListener('click', onAnchor, true)

  // Si cambia el ancho, se arma todo de nuevo (las alturas de los mensajes y los planos cambian)
  let timer = 0
  const onResize = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      if (Math.abs(window.innerWidth - builtWidth) < 2) return
      ctx?.revert()
      build()
      ScrollTrigger.refresh()
    }, 250)
  }
  window.addEventListener('resize', onResize)
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true })
  // Recalcula cuando cargan imágenes que cambian alturas
  let roTimer = 0
  const ro = new ResizeObserver(() => {
    window.clearTimeout(roTimer)
    roTimer = window.setTimeout(() => ScrollTrigger.refresh(), 200)
  })
  const main = document.getElementById('contenido')
  if (main) ro.observe(main)

  root.classList.add('zv-motion')

  return () => {
    window.removeEventListener('resize', onResize)
    document.removeEventListener('click', onAnchor, true)
    ScrollTrigger.removeEventListener('refresh', measure)
    ro.disconnect()
    window.clearTimeout(timer)
    delete window.zvGoTo
    ctx?.revert()
    gsap.ticker.remove(tick)
    lenis.destroy()
    root.classList.remove('zv-motion')
  }
}

