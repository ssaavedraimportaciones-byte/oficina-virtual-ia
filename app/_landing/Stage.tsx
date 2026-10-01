'use client'

import { Fragment, useEffect, useRef } from 'react'
import '@fontsource-variable/fraunces'
import { bus } from './bus'
import { CHAPTERS, DEMO_NOTE, FLIGHTS, HANDOFF_REASON, HANDOFF_SUBJECT, SUMMARY_SHOT } from './data'

/** Un título partido en palabras para revelarlas una a una; el texto entero queda para lectores de pantalla. */
export function SplitWords({ text, accent = [], breakAfter = [] }: { text: string; accent?: number[]; breakAfter?: number[] }) {
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split(' ').map((word, i) => (
          <Fragment key={`${word}-${i}`}>
            <span className={accent.includes(i) ? 'zv-w zv-acc' : 'zv-w'} style={{ '--i': i } as React.CSSProperties}>
              {word}
            </span>
            {breakAfter.includes(i) && <br />}
          </Fragment>
        ))}
      </span>
    </>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Guion de la noche, en unidades de la línea de tiempo (10 por capítulo).
 * `in` = aparece la burbuja en la ventana de origen, `fly` = sale volando,
 * `land` = llega, `out` = se desvanece.
 */
const FLIGHT_CUES: Record<string, { in: number; fly: number; land: number; out: number }> = {
  f1: { in: 1.8, fly: 2.8, land: 4.3, out: 6.6 },
  f2: { in: 4.9, fly: 5.6, land: 7.1, out: 9.2 },
  f3: { in: 11.8, fly: 12.4, land: 13.7, out: 15.2 },
  f4: { in: 14.0, fly: 14.6, land: 15.9, out: 17.0 },
  f5: { in: 21.6, fly: 22.1, land: 23.3, out: 24.8 },
  f6: { in: 23.8, fly: 24.4, land: 25.7, out: 27.0 },
  f7: { in: 31.8, fly: 32.3, land: 33.6, out: 35.4 },
  f8: { in: 34.0, fly: 34.6, land: 35.9, out: 37.6 },
  f9: { in: 36.6, fly: 37.0, land: 38.3, out: 39.6 },
  f10: { in: 44.4, fly: 44.9, land: 46.2, out: 47.6 },
}
const INSERTS: { id: string; in: number; out?: number }[] = [
  { id: 'agenda', in: 16.6, out: 19.4 },
  { id: 'venta', in: 26.9, out: 29.4 },
  { id: 'amanece', in: 41.8, out: 44.2 },
  { id: 'resumen', in: 47.8 },
]
const CHAPTER_UNITS = 10

export default function Stage() {
  const stageRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = document.documentElement
    const stage = stageRef.current
    if (!root.classList.contains('js-motion') || !stage) return

    let cancelled = false
    let cleanup = () => {}

    const run = async () => {
      const [{ default: gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
        import('lenis'),
      ])
      if (cancelled) return
      gsap.registerPlugin(ScrollTrigger)
      ScrollTrigger.config({ ignoreMobileResize: true })
      if (document.fonts?.ready) await document.fonts.ready
      if (cancelled) return

      const lenis = new Lenis({ lerp: 0.09, anchors: { offset: -72 } })
      lenis.on('scroll', ScrollTrigger.update)
      const tick = (time: number) => lenis.raf(time * 1000)
      gsap.ticker.add(tick)
      gsap.ticker.lagSmoothing(0)

      const hero = document.querySelector<HTMLElement>('[data-hero]')
      const heroContent = document.querySelector<HTMLElement>('[data-hero-content]')
      const q = <T extends HTMLElement>(sel: string) => Array.from(stage.querySelectorAll<T>(sel))
      const one = <T extends HTMLElement>(sel: string) => stage.querySelector<T>(sel)

      let ctx: ReturnType<typeof gsap.context> | undefined
      let builtWidth = 0

      const build = () => {
        builtWidth = window.innerWidth
        const lite = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches

        // Cada armado parte de la noche en su estado inicial; los tweens registran desde acá.
        Object.assign(bus, { cam: 0, shop: 0.3, owner: 1, ownerPhone: 0, anaPhone: 0, sold: 0, dawn: 0, rain: 0 })
        FLIGHTS.forEach((f) => (bus.fl[f.id] = 0))

        ctx = gsap.context(() => {
          // 1) Portada: el título se va y la cámara baja del cielo a la calle.
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
              gsap.to(heroContent, {
                opacity: 0,
                y: -70,
                ease: 'none',
                scrollTrigger: { trigger: hero, start: 'top top', end: '55% top', scrub: true },
              })
            }
          }

          // 2) La noche: un escenario fijo. El scroll es el tiempo.
          const rail = q('[data-rail]')
          const clock = one('[data-clock]')
          const proxy = { m: CHAPTERS[0].minutes, stock: 12 }
          const renderClock = () => {
            if (!clock) return
            const m = Math.round(proxy.m) % 1440
            clock.textContent = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
          }
          const stockEl = one('[data-stock]')
          const renderStock = () => {
            if (stockEl) stockEl.textContent = String(Math.round(proxy.stock))
          }

          const tl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: stage,
              start: 'top top',
              end: () => `+=${Math.round(window.innerHeight * 10)}`,
              pin: true,
              scrub: 0.9,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              onUpdate: (self) => {
                const active = Math.min(CHAPTERS.length - 1, Math.floor(self.progress * CHAPTERS.length))
                rail.forEach((el, i) => {
                  const state = i === active ? 'on' : i < active ? 'past' : 'next'
                  if (el.dataset.state !== state) el.dataset.state = state
                })
              },
            },
          })
          // Duración total fija: 5 capítulos.
          tl.set({}, {}, CHAPTER_UNITS * CHAPTERS.length)

          // Barras de cine: se cierran al entrar a la noche
          tl.fromTo(q('[data-bar]'), { scaleY: 0 }, { scaleY: 1, duration: 0.8, ease: 'power2.out' }, 0)


          // Subtítulos y escena de cada capítulo
          q('[data-copy]').forEach((copy, i) => {
            const o = i * CHAPTER_UNITS
            const words = Array.from(copy.querySelectorAll('.zv-w'))
            const bits = Array.from(copy.querySelectorAll('.zv-sub-b'))
            tl.fromTo(copy, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, o + 0.2)
            tl.fromTo(words, { opacity: 0, yPercent: 40, filter: lite ? 'none' : 'blur(6px)' }, { opacity: 1, yPercent: 0, filter: 'blur(0px)', stagger: 0.06, duration: 0.6, ease: 'power3.out' }, o + 0.25)
            tl.fromTo(bits, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, o + 0.8)
            if (i < CHAPTERS.length - 1) tl.to(copy, { autoAlpha: 0, y: -12, duration: 0.5, ease: 'power1.in' }, o + CHAPTER_UNITS - 0.6)
          })
          q('[data-scene]').forEach((card, i) => {
            const o = i * CHAPTER_UNITS
            tl.fromTo(card, { autoAlpha: 0, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'power3.out' }, o)
            if (i < CHAPTERS.length - 1) tl.to(card, { autoAlpha: 0, duration: 0.4 }, o + CHAPTER_UNITS - 0.5)
          })
          ;[1, 2, 3, 4].forEach((i) => {
            tl.to(proxy, { m: CHAPTERS[i].minutes, duration: 1.4, ease: 'power1.inOut', onUpdate: renderClock }, i * CHAPTER_UNITS - 0.8)
          })

          // Rótulos sobre las ventanas
          tl.fromTo(q('[data-anchor]:not([data-anchor="shelf"])'), { autoAlpha: 0 }, { autoAlpha: 1, stagger: 0.35, duration: 0.5 }, 0.5)
          const status = (id: string, from: string, to: string, at: number) => {
            const a = one(`[data-st="${id}-${from}"]`)
            const b = one(`[data-st="${id}-${to}"]`)
            if (a) tl.to(a, { autoAlpha: 0, duration: 0.3 }, at)
            if (b) tl.fromTo(b, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, at)
          }

          // --- 01 · 23:47 La cuadra. Caro apaga la luz; Ana escribe; el local cerrado responde.
          tl.to(bus, { owner: 0, duration: 0.8, ease: 'power2.in' }, 0.9)
          status('owner', 'a', 'b', 1.4)
          tl.to(bus, { anaPhone: 1, duration: 0.4 }, 1.4)
          tl.to(bus, { shop: 1, duration: 0.6, ease: 'power2.out' }, 4.3)
          status('shop', 'a', 'b', 4.4)

          // En los primeros planos del local, su rótulo sobra.
          const shopLabel = one('[data-anchor="shop"]')
          if (shopLabel) {
            tl.to(shopLabel, { autoAlpha: 0, duration: 0.4 }, 9.6)
            tl.to(shopLabel, { autoAlpha: 1, duration: 0.5 }, 30.6)
          }

          // --- 02 · 23:52 La vitrina
          tl.to(bus, { cam: 1, duration: 2.2, ease: 'power2.inOut' }, 9.4)
          // --- 03 · 00:06 El estante
          tl.to(bus, { cam: 2, duration: 2.0, ease: 'power2.inOut' }, 19.4)
          const shelf = one('[data-anchor="shelf"]')
          if (shelf) {
            tl.fromTo(shelf, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 21.2)
            tl.to(shelf, { autoAlpha: 0, duration: 0.4 }, 29.2)
          }
          tl.to(bus, { sold: 2, duration: 1.2, ease: 'power2.inOut' }, 25.7)
          tl.to(proxy, { stock: 10, duration: 1.2, ease: 'power2.inOut', onUpdate: renderStock }, 25.7)
          if (stockEl) tl.fromTo(stockEl, { color: '#f1e8d6' }, { color: '#ffb347', duration: 0.3 }, 25.7)

          // --- 04 · 02:31 Lluvia. Reclamo, el agente se pausa y le avisa a Caro.
          tl.to(bus, { cam: 3, duration: 2.2, ease: 'power2.inOut' }, 29.4)
          tl.to(bus, { rain: 1, duration: 1.6 }, 30)
          tl.to(bus, { shop: 0.18, duration: 0.6 }, 36.2)
          status('shop', 'b', 'c', 36.2)
          tl.to(bus, { ownerPhone: 1, duration: 0.3 }, 38.3)
          status('owner', 'b', 'c', 38.4)

          // --- 05 · 08:05 Amanece. Caro despierta y responde desde el panel.
          tl.to(bus, { rain: 0, duration: 1.6 }, 40)
          tl.to(bus, { dawn: 0.55, duration: 3 }, 40)
          tl.to(bus, { owner: 1, ownerPhone: 0, duration: 0.8 }, 41)
          status('owner', 'c', 'd', 41.2)
          tl.to(bus, { cam: 4, dawn: 1, duration: 3.6, ease: 'power2.inOut' }, 46.2)
          tl.to(q('[data-anchor]:not([data-anchor="shelf"])'), { autoAlpha: 0, duration: 0.6 }, 46.4)

          // Mensajes que viajan de ventana en ventana
          FLIGHTS.forEach((f) => {
            const cue = FLIGHT_CUES[f.id]
            const el = one(`[data-flight="${f.id}"]`)
            if (!el) return
            // El contenedor lo posiciona el mundo 3D (transform); acá solo se anima la burbuja de adentro.
            tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, cue.in)
            tl.fromTo(el.firstElementChild, { scale: 0.9, y: 10 }, { scale: 1, y: 0, duration: 0.4, ease: 'power3.out' }, cue.in)
            tl.fromTo(bus.fl, { [f.id]: 0 }, { [f.id]: 1, duration: cue.land - cue.fly, ease: 'power1.inOut' }, cue.fly)
            const ticks = el.querySelector('[data-ticks]')
            if (ticks) tl.fromTo(ticks, { color: '#8a6a3a' }, { color: '#1d6fa0', duration: 0.3 }, cue.land + 0.2)
            tl.to(el, { autoAlpha: 0, duration: 0.4 }, cue.out)
          })

          // Insertos: las capturas reales del panel, como un corte de cámara
          const veil = one('[data-veil]')
          INSERTS.forEach(({ id, in: at, out }) => {
            const shot = one(`[data-shot="${id}"]`)
            if (!shot) return
            const ring = shot.querySelector('[data-ring]')
            tl.fromTo(shot, { autoAlpha: 0, y: 40, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out' }, at)
            if (veil) tl.to(veil, { autoAlpha: 1, duration: 0.6 }, at)
            if (ring) tl.fromTo(ring, { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' }, at + 0.8)
            if (out !== undefined) {
              tl.to(shot, { autoAlpha: 0, y: -20, ...(lite ? {} : { filter: 'blur(8px)' }), duration: 0.6, ease: 'power1.in' }, out)
              if (veil) tl.to(veil, { autoAlpha: 0, duration: 0.6 }, out)
            }
          })

          renderClock()
          renderStock()
        }, stage)
      }

      build()
      ScrollTrigger.refresh()

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

      cleanup = () => {
        window.removeEventListener('resize', onResize)
        window.clearTimeout(timer)
        ctx?.revert()
        gsap.ticker.remove(tick)
        lenis.destroy()
      }
      if (cancelled) cleanup()
    }

    void run()
    return () => {
      cancelled = true
      cleanup()
    }
  }, [])

  const shots = [...CHAPTERS.filter((c) => c.shot).map((c) => ({ id: c.id, ...c.shot! })), { id: 'resumen', ...SUMMARY_SHOT }]

  return (
    <section ref={stageRef} className="zv-stage" aria-label="Una noche con ZeroVisto, en cinco escenas">
      <div className="zv-scrim" />
      <div className="zv-veil" data-veil />

      {/* Rótulos que siguen a las ventanas del mundo 3D */}
      <div className="zv-anchors" aria-hidden="true">
        <div className="zv-anchor" data-anchor="ana">
          <i />
          <span className="zv-anchor-n">Ana</span>
          <span className="zv-anchor-s">
            <span data-st="ana-a">escribe desde su casa</span>
          </span>
        </div>
        <div className="zv-anchor zv-anchor--up" data-anchor="shop">
          <i />
          <span className="zv-anchor-n">Uñas Bella</span>
          <span className="zv-anchor-s">
            <span data-st="shop-a">cerrado</span>
            <span data-st="shop-b">cerrado · responde ZeroVisto</span>
            <span data-st="shop-c">agente en pausa · le avisó a Caro</span>
          </span>
        </div>
        <div className="zv-anchor" data-anchor="owner">
          <i />
          <span className="zv-anchor-n">Caro, la dueña</span>
          <span className="zv-anchor-s">
            <span data-st="owner-a">cerrando el día</span>
            <span data-st="owner-b">durmiendo</span>
            <span data-st="owner-c">le llegó el aviso</span>
            <span data-st="owner-d">responde desde el panel</span>
          </span>
        </div>
        <div className="zv-anchor zv-anchor--shelf" data-anchor="shelf">
          <i />
          <span className="zv-anchor-n">Esmalte semipermanente</span>
          <span className="zv-anchor-s zv-anchor-s--stock">
            stock <b data-stock>12</b>
          </span>
        </div>
      </div>

      {/* Mensajes que viajan */}
      <div className="zv-flights" aria-hidden="true">
        {FLIGHTS.map((f) => (
          <div key={f.id} className="zv-flight" data-flight={f.id} data-kind={f.kind}>
            <div className="zv-fb">
              <p className="zv-fb-from">{f.label}</p>
              {f.kind === 'mail' ? (
                <>
                  <p className="zv-fb-subj">{HANDOFF_SUBJECT}</p>
                  <p className="zv-fb-body">Motivo: {HANDOFF_REASON}</p>
                </>
              ) : (
                <p className="zv-fb-body">{f.text}</p>
              )}
              {f.kind === 'agent' && (
                <p className="zv-fb-meta">
                  <span data-ticks>✓✓</span>
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Insertos: capturas reales del panel */}
      <div className="zv-inserts">
        {shots.map((shot) => (
          <figure key={shot.id} className="zv-shot" data-shot={shot.id}>
            <figcaption>
              <span>{shot.caption}</span>
              <span>panel real · datos de demostración</span>
            </figcaption>
            <div className="zv-shot-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.src} alt={shot.alt} width={shot.width} height={shot.height} decoding="async" />
              <span
                className="zv-ring"
                data-ring
                style={{ left: `${shot.ring.left}%`, top: `${shot.ring.top}%`, width: `${shot.ring.width}%`, height: `${shot.ring.height}%` }}
              />
            </div>
          </figure>
        ))}
      </div>

      {/* Tarjeta de escena: hora y lugar */}
      <div className="zv-scenes">
        {CHAPTERS.map((c, i) => (
          <div key={c.id} className="zv-scene" data-scene aria-hidden="true">
            <p className="zv-scene-k">
              Escena {pad(i + 1)} · {c.kicker}
            </p>
          </div>
        ))}
        <p className="zv-clock" data-clock aria-hidden="true">
          {CHAPTERS[0].time}
        </p>
        <p className="zv-place" aria-hidden="true">
          Una calle de Santiago · demostración
        </p>
      </div>

      <ol className="zv-rail" aria-hidden="true">
        {CHAPTERS.map((c, i) => (
          <li key={c.id} data-rail data-state={i === 0 ? 'on' : 'next'}>
            <span className="zv-rail-n">{pad(i + 1)}</span>
            <span className="zv-rail-t">{c.time}</span>
          </li>
        ))}
      </ol>

      {/* Subtítulos */}
      <div className="zv-subs">
        {CHAPTERS.map((c) => (
          <article key={c.id} className="zv-sub" data-copy>
            <h2 className="zv-sub-h">
              <SplitWords text={c.title} />
            </h2>
            <p className="zv-sub-b">{c.body}</p>
          </article>
        ))}
      </div>

      <div className="zv-bar zv-bar--top" data-bar aria-hidden="true" />
      <div className="zv-bar zv-bar--bottom" data-bar aria-hidden="true">
        <p className="zv-demo">{DEMO_NOTE}</p>
      </div>

      {/* La conversación completa, para lectores de pantalla */}
      <ol className="sr-only">
        {FLIGHTS.map((f) => (
          <li key={f.id}>
            {f.label}: {f.kind === 'mail' ? `${HANDOFF_SUBJECT}. Motivo: ${HANDOFF_REASON}` : f.text}
          </li>
        ))}
      </ol>
    </section>
  )
}
