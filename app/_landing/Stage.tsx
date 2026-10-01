'use client'

import { Fragment, useEffect, useRef } from 'react'
import '@fontsource-variable/fraunces'
import { bus } from './bus'
import { CHAPTERS, DEMO_NOTE, HANDOFF_REASON, HANDOFF_SUBJECT, MESSAGES } from './data'

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

// Cuándo (en unidades de la línea de tiempo: 10 por capítulo) entra cada cosa.
// Los mensajes del agente muestran primero «escribiendo…» y un segundo después el texto.
const AT: Record<string, number> = {
  m01: 1.0,
  m02: 1.8,
  m03: 4.6,
  m04: 5.4,
  m05: 11.2,
  m06: 12.0,
  m07: 21.2,
  m08: 22.0,
  m09: 24.6,
  m10: 25.2,
  m11: 31.2,
  m12: 32.0,
  m13: 41.2,
}
const TYPING = 1.0
const SHOT_IN: Record<string, number> = { agenda: 14.6, venta: 27.6, persona: 36.4, amanece: 42.6 }
const SHOT_OUT: Record<string, number> = { agenda: 19.3, venta: 29.3, persona: 39.3 }
const CHAPTER_UNITS = 10

const pad = (n: number) => String(n).padStart(2, '0')

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

      // Un solo motor de scroll suave; GSAP lo sigue.
      const lenis = new Lenis({ lerp: 0.1, anchors: { offset: -72 } })
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
        const mobile = window.matchMedia('(max-width: 820px)').matches
        const lite = mobile || window.matchMedia('(pointer: coarse)').matches

        ctx = gsap.context(() => {
          // 1) Portada: el título se va y la cámara baja a la calle.
          if (hero) {
            ScrollTrigger.create({
              trigger: hero,
              start: 'top top',
              end: 'bottom bottom',
              onUpdate: (self) => {
                bus.u = self.progress
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

          // 2) La noche: un escenario fijo cuyo avance es la hora.
          const copies = q('[data-copy]')
          const vwords = q('[data-vert]')
          const rail = q('[data-rail]')
          const clock = one('[data-clock]')
          const phone = one('[data-phone]')
          const proxy = { m: CHAPTERS[0].minutes }
          const renderClock = () => {
            if (!clock) return
            const m = Math.round(proxy.m) % 1440
            clock.textContent = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
          }

          const tl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: stage,
              start: 'top top',
              end: () => `+=${Math.round(window.innerHeight * 8)}`,
              pin: true,
              scrub: 0.6,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              onUpdate: (self) => {
                const p = self.progress
                bus.u = 1 + Math.min(4, Math.max(0, p * 5 - 0.5))
                const active = Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length))
                rail.forEach((el, i) => {
                  const state = i === active ? 'on' : i < active ? 'past' : 'next'
                  if (el.dataset.state !== state) el.dataset.state = state
                })
              },
            },
          })

          // Texto de cada capítulo
          copies.forEach((copy, i) => {
            const o = i * CHAPTER_UNITS
            const words = Array.from(copy.querySelectorAll('.zv-w'))
            const bits = Array.from(copy.querySelectorAll('.zv-k, .zv-b'))
            const vert = vwords[i]
            if (i === 0) gsap.set([copy, vert], { autoAlpha: 1 })
            else tl.fromTo([copy, vert], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, o)
            tl.fromTo(vert, { yPercent: 6 }, { yPercent: 0, duration: 1.6, ease: 'power2.out' }, o)
            tl.fromTo(
              words,
              { opacity: 0.1, yPercent: 38 },
              { opacity: 1, yPercent: 0, stagger: 0.07, duration: 0.5, ease: 'power2.out' },
              o + (i === 0 ? 0 : 0.1),
            )
            tl.fromTo(
              bits,
              { opacity: 0, y: 14 },
              { opacity: 1, y: 0, stagger: 0.12, duration: 0.6, ease: 'power2.out' },
              o + (i === 0 ? 0 : 0.2),
            )
            if (i < copies.length - 1) {
              tl.to(copy, { autoAlpha: 0, y: -26, duration: 0.6, ease: 'power1.in' }, o + CHAPTER_UNITS - 0.7)
              tl.to(vert, { autoAlpha: 0, duration: 0.6, ease: 'power1.in' }, o + CHAPTER_UNITS - 0.7)
            }
          })

          // Reloj
          ;[1, 2, 3, 4].forEach((i) => {
            tl.to(proxy, { m: CHAPTERS[i].minutes, duration: 1.4, ease: 'power1.inOut', onUpdate: renderClock }, i * CHAPTER_UNITS - 1.2)
          })

          // Conversación
          MESSAGES.forEach((msg) => {
            const el = one(`[data-msg="${msg.id}"]`)
            if (!el) return
            const at = AT[msg.id]
            if (msg.who === 'agent') {
              const typing = one(`[data-typing="${msg.id}"]`)
              if (typing) {
                tl.fromTo(typing, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.2, ease: 'power2.out' }, at)
                tl.to(typing, { height: 0, opacity: 0, duration: 0.2, ease: 'power2.in' }, at + TYPING)
              }
              tl.fromTo(el, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.35, ease: 'power2.out' }, at + TYPING)
              const ticks = el.querySelector('[data-ticks]')
              const read = el.querySelector('[data-read]')
              if (ticks) tl.fromTo(ticks, { color: '#7d879f' }, { color: '#53bdeb', duration: 0.3 }, at + TYPING + 0.9)
              if (read) tl.fromTo(read, { opacity: 0 }, { opacity: 1, duration: 0.3 }, at + TYPING + 0.9)
            } else {
              tl.fromTo(el, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.35, ease: 'power2.out' }, at)
            }
          })

          // El agente se pausa y aparece el aviso por mail
          const statusA = one('[data-status-a]')
          const statusB = one('[data-status-b]')
          if (statusA && statusB) {
            tl.to(statusA, { opacity: 0, duration: 0.3 }, 34.2)
            tl.to(statusB, { opacity: 1, duration: 0.3 }, 34.2)
          }
          const toast = one('[data-toast]')
          if (toast) {
            tl.fromTo(toast, { autoAlpha: 0, y: -24 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 34.7)
            tl.to(toast, { autoAlpha: 0, y: -12, duration: 0.5, ease: 'power1.in' }, 39.3)
          }

          // Capturas reales del panel: entran enteras, se quedan fijas y se difuminan al pasar el relevo
          Object.entries(SHOT_IN).forEach(([id, at]) => {
            const shot = one(`[data-shot="${id}"]`)
            if (!shot) return
            const ring = shot.querySelector('[data-ring]')
            tl.fromTo(shot, { autoAlpha: 0, y: 46, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.9, ease: 'power3.out' }, at)
            if (ring) tl.fromTo(ring, { opacity: 0, scale: 1.05 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' }, at + 0.9)
            const out = SHOT_OUT[id]
            if (out !== undefined) {
              tl.to(shot, { autoAlpha: 0, y: -20, ...(lite ? {} : { filter: 'blur(8px)' }), duration: 0.7, ease: 'power1.in' }, out)
            }
            // En el teléfono chico, la captura tapa el chat: se aparta mientras está.
            if (mobile && phone) {
              tl.to(phone, { opacity: 0.08, duration: 0.5 }, at)
              if (out !== undefined) tl.to(phone, { opacity: 1, duration: 0.5 }, out)
            }
          })

          renderClock()
        }, stage)
      }

      build()
      ScrollTrigger.refresh()

      // Los mensajes miden su altura real; si cambia el ancho hay que armar todo de nuevo.
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

  return (
    <section ref={stageRef} className="zv-stage" aria-label="Una noche con ZeroVisto, en cinco momentos">
      <div className="zv-scrim" />

      <div className="zv-hud" aria-hidden="true">
        <p className="zv-hudlabel">Hora en el local · demostración</p>
        <p className="zv-clock" data-clock>
          {CHAPTERS[0].time}
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

      <div className="zv-copywrap">
        {CHAPTERS.map((c, i) => (
          <article key={c.id} className="zv-copy" data-copy>
            <p className="zv-k">
              <span>{pad(i + 1)}</span> {c.time} · {c.kicker}
            </p>
            <h2 className="zv-h">
              <SplitWords text={c.title} />
            </h2>
            <p className="zv-b">{c.body}</p>
          </article>
        ))}
      </div>

      <div className="zv-vwrap" aria-hidden="true">
        {CHAPTERS.map((c) => (
          <span key={c.id} className="zv-v" data-vert>
            {c.vertical}
          </span>
        ))}
      </div>

      <div className="zv-pane">
        <div className="zv-phone" data-phone role="img" aria-label="Conversación de demostración entre Ana y el agente de Uñas Bella">
          <header className="zv-phonehead">
            <span className="zv-phoneemoji" aria-hidden="true">
              💅
            </span>
            <div>
              <strong>Uñas Bella</strong>
              <span className="zv-status">
                <span data-status-a>en línea · responde el agente</span>
                <span data-status-b>atiende una persona</span>
              </span>
            </div>
          </header>
          <div className="zv-chat">
            {MESSAGES.map((m) => (
              <Fragment key={m.id}>
                {m.who === 'agent' && (
                  <div className="zv-typing" data-typing={m.id}>
                    <div className="zv-typing-in">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                )}
                <div className="zv-msg" data-who={m.who} data-msg={m.id}>
                  <div className="zv-msg-in">
                    <div className="zv-bubble">{m.text}</div>
                    {m.who === 'agent' && (
                      <div className="zv-meta">
                        <span data-read>leído</span>
                        <span data-ticks>✓✓</span>
                      </div>
                    )}
                    {m.who === 'human' && <div className="zv-meta">Equipo</div>}
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </div>

        <div className="zv-shotslot">
          {CHAPTERS.filter((c) => c.shot).map((c) => {
            const shot = c.shot!
            return (
              <figure key={c.id} className="zv-shot" data-shot={c.id}>
                <div className="zv-shot-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shot.src} alt={shot.alt} width={shot.width} height={shot.height} decoding="async" />
                  <span
                    className="zv-ring"
                    data-ring
                    style={{ left: `${shot.ring.left}%`, top: `${shot.ring.top}%`, width: `${shot.ring.width}%`, height: `${shot.ring.height}%` }}
                  />
                </div>
                <figcaption>
                  <span>{shot.caption}</span>
                  <span>datos de demostración</span>
                </figcaption>
              </figure>
            )
          })}
        </div>

        <aside className="zv-toast" data-toast aria-label="Aviso por correo al dueño">
          <p className="zv-toast-k">Correo al dueño</p>
          <p className="zv-toast-s">{HANDOFF_SUBJECT}</p>
          <p className="zv-toast-b">Motivo: {HANDOFF_REASON}</p>
        </aside>
      </div>

      <p className="zv-demo" aria-hidden="true">
        {DEMO_NOTE}
      </p>
    </section>
  )
}
