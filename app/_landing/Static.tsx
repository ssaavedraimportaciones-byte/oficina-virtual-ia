import { CHAPTERS, DEMO_NOTE, HANDOFF_REASON, HANDOFF_SUBJECT, MESSAGES, SUMMARY_SHOT } from './data'

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * La misma noche, sin movimiento: se ve cuando el navegador pide menos
 * animación o cuando no hay JavaScript. Nada de lo importante depende del scroll.
 */
export default function StaticStory() {
  return (
    <section className="zv-static" aria-labelledby="zv-static-title">
      <h2 id="zv-static-title" className="sr-only">
        Una noche con ZeroVisto, en cinco momentos
      </h2>
      {CHAPTERS.map((c, i) => (
        <article key={c.id} id={c.id} className="zv-sc" data-tone={i === CHAPTERS.length - 1 ? 'dawn' : 'night'}>
          <div className="zv-sc-copy">
            <p className="zv-k">
              <span>{pad(i + 1)}</span> {c.time} · {c.kicker}
            </p>
            <h3 className="zv-h">{c.title}</h3>
            <p className="zv-b">{c.body}</p>
          </div>
          <div className="zv-sc-vis">
            <div className="zv-phone zv-phone--static">
              <div className="zv-chat">
                {MESSAGES.filter((m) => m.chapter === i).map((m) => (
                  <div key={m.id} className="zv-msg" data-who={m.who}>
                    <div className="zv-msg-in">
                      <div className="zv-bubble">{m.text}</div>
                      {m.who === 'human' && <div className="zv-meta">Equipo</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {i === 3 && (
              <aside className="zv-toast zv-toast--static" aria-label="Aviso por correo al dueño">
                <p className="zv-toast-k">Correo al dueño</p>
                <p className="zv-toast-s">{HANDOFF_SUBJECT}</p>
                <p className="zv-toast-b">Motivo: {HANDOFF_REASON}</p>
              </aside>
            )}
            {[c.shot, i === CHAPTERS.length - 1 ? SUMMARY_SHOT : undefined].map((shot) =>
              shot ? (
                <figure key={shot.src} className="zv-shot zv-shot--static">
                  <div className="zv-shot-img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={shot.src} alt={shot.alt} width={shot.width} height={shot.height} loading="lazy" decoding="async" />
                  </div>
                  <figcaption>
                    <span>{shot.caption}</span>
                    <span>panel real · datos de demostración</span>
                  </figcaption>
                </figure>
              ) : null,
            )}
          </div>
        </article>
      ))}
      <p className="zv-demo zv-demo--static">{DEMO_NOTE}</p>
    </section>
  )
}
