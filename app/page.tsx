import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import Foreground from './_landing/Foreground'
import Motion from './_landing/Motion'
import Nav from './_landing/Nav'
import Pointer from './_landing/Pointer'
import Preloader from './_landing/Preloader'
import Rail from './_landing/Rail'
import Stage, { SplitWords } from './_landing/Stage'
import StaticStory from './_landing/Static'
import World from './_landing/World'
import { CASES, FACTS, GUARDRAILS, INTEGRATIONS, MULTI, STEPS, STREET } from './_landing/data'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/fraunces/index.css'
import '@fontsource-variable/fraunces/wght-italic.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import './_landing/landing.css'

const pad = (n: number) => String(n).padStart(2, '0')

function SectionHead({ id, n, label, title, intro, accent = [], big = false }: { id: string; n: string; label: string; title: string; intro?: string; accent?: number[]; big?: boolean }) {
  return (
    <header className={`zv-head${big ? ' zv-head--big' : ''}`} data-reveal>
      <p className="zv-label" data-reveal-item>
        <span>{n}</span> — {label}
      </p>
      <h2 id={id} className={`zv-h2${big ? ' zv-h2--case' : ''}`}>
        <SplitWords text={title} accent={accent} />
      </h2>
      {intro && (
        <p className="zv-intro" data-reveal-item>
          {intro}
        </p>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section id="inicio" className="zv-hero" data-hero data-section="inicio" aria-labelledby="zv-hero-title">
      <div className="zv-hero-in" data-hero-content>
        <div className="zv-hero-grid">
          <div className="zv-hero-main">
            <p className="zv-label zv-hero-k">
              <span>00</span> — Agentes de IA para WhatsApp e Instagram
            </p>
            <h1 id="zv-hero-title" className="zv-h1">
              <SplitWords text={`Tu cliente escribe. ${BRAND.name} responde.`} accent={[4]} breakAfter={[2]} />
            </h1>
          </div>
          <div className="zv-hero-side">
            <p className="zv-lead">
              Un agente de IA que atiende tu WhatsApp e Instagram al tiro, a cualquier hora: responde dudas, agenda horas,
              toma pedidos y te pasa el caso cuando hace falta una persona.
            </p>
            <div className="zv-cta-row">
              <Link href="/registro" className="zv-btn" data-magnetic data-cursor="Empezar">
                Probar gratis <span aria-hidden="true">↗</span>
              </Link>
              <a href="#noche" className="zv-btn zv-btn--ghost" data-magnetic data-cursor="Ver">
                Ver una noche entera
              </a>
            </div>
          </div>
        </div>
        <dl className="zv-facts">
          {FACTS.map((f) => (
            <div key={f.label} className="zv-fact">
              <dt>{f.value}</dt>
              <dd>{f.label}</dd>
            </div>
          ))}
        </dl>
        <p className="zv-cue" aria-hidden="true">
          <i /> Baja: empieza la noche
        </p>
      </div>
    </section>
  )
}

function Rubros() {
  return (
    <section id="rubros" className="zv-sec zv-rubros" data-section="rubros" aria-labelledby="zv-rubros-title">
      <div className="zv-sticky">
        <div className="zv-col">
          <SectionHead
            id="zv-rubros-title"
            n="06"
            label="Rubros"
            title="Se adapta a cualquier rubro."
            intro="Cada negocio parte con una plantilla: el tono, lo que el agente pregunta y lo que conviene cargarle. Todo se edita después."
          />
          <ol className="zv-index" data-reveal>
            {/* El local de esta noche: queda activo hasta que la calle empieza a encenderse */}
            <li className="zv-index-row" data-reveal-item data-rubro={-1}>
              <span className="zv-index-n">00</span>
              <span className="zv-index-e" aria-hidden="true">
                💅
              </span>
              <span className="zv-index-l">Manicura y uñas</span>
              <span className="zv-index-d">Como Uñas Bella, la de esta noche: precio, hora y pedido de esmaltes.</span>
            </li>
            {STREET.map((s, i) => (
              <li key={s.id} className="zv-index-row" data-reveal-item data-rubro={i}>
                <span className="zv-index-n">{pad(i + 1)}</span>
                <span className="zv-index-e" aria-hidden="true">
                  {s.emoji}
                </span>
                <span className="zv-index-l">{s.label}</span>
                <span className="zv-index-d">{s.does}</span>
              </li>
            ))}
          </ol>
        </div>
        {/* Rótulos que siguen a cada letrero de la calle */}
        <div className="zv-tags" aria-hidden="true">
          {STREET.map((s, i) => (
            <div key={s.id} className="zv-tag" data-anchor={`rubro-${s.id}`} data-tag={i} data-keepout="left">
              <span className="zv-tag-l">
                {s.emoji} {s.label}
              </span>
              <span className="zv-tag-d">{s.does}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Negocios() {
  return (
    <section id="negocios" className="zv-sec zv-negocios" data-section="negocios" aria-labelledby="zv-negocios-title">
      <div className="zv-sticky">
        <div className="zv-col">
          <SectionHead id="zv-negocios-title" n="07" label="Varios negocios" title="Muchos negocios. Cero mezcla." accent={[2, 3]} />
          <div className="zv-cols" data-reveal>
            {MULTI.map((m, i) => (
              <article key={m.title} className="zv-card" data-reveal-item data-tilt>
                <div className="zv-tilt">
                  <p className="zv-card-n">{pad(i + 1)}</p>
                  <h3>{m.title}</h3>
                  <p>{m.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="zv-roofs" aria-hidden="true">
          {STREET.map((s) => (
            <span key={s.id} className="zv-roof" data-anchor={`roof-${s.id}`} data-keepout="right">
              <i /> {s.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function Limites() {
  return (
    <section id="limites" className="zv-sec zv-limites" data-section="limites" aria-labelledby="zv-limites-title">
      <div className="zv-col zv-col--wide">
        <SectionHead
          id="zv-limites-title"
          n="08"
          label="Con los pies en la tierra"
          title="Lo que el agente no hace."
          intro="Un agente que contesta a las once de la noche tiene que saber cuándo parar. Esto ya viene resuelto."
        />
        <ol className="zv-list" data-reveal>
          {GUARDRAILS.map((g, i) => (
            <li key={g.title} data-reveal-item>
              <span className="zv-list-n">{pad(i + 1)}</span>
              <h3>{g.title}</h3>
              <p>{g.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Caso({ caso, index }: { caso: (typeof CASES)[number]; index: number }) {
  const flip = index % 2 === 1
  const phone = (
    <div className="zv-phone zv-ft-phone" data-reveal-item>
      <div className="zv-ft-head">
        <div className="zv-ft-id">
          <span className="zv-ft-name">{caso.name}</span>
          <span className="zv-ft-place">{caso.place}</span>
        </div>
        <button type="button" className="zv-replay" data-replay aria-label="Ver la conversación de nuevo" title="Ver de nuevo">
          <span aria-hidden="true">↻</span>
        </button>
      </div>
      <p className="zv-ft-status" data-status>
        <i aria-hidden="true" />
        <span data-status-text>Agente IA · en línea</span>
      </p>
      <div className="zv-chat zv-chat--caso" data-chat>
        <div className="zv-chat-track" data-track>
          {caso.messages.map((m, i) => (
            <div key={i} className="zv-msg" data-who={m.who} data-msg={i}>
              {m.who === 'agent' && (
                <span className="zv-typing" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              )}
              <div className="zv-msg-in">
                <div className="zv-bubble">{m.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
  const side = (
    <div className="zv-ft-side" data-reveal-item>
      <p className="zv-ft-kick">Qué hizo el agente</p>
      <ol className="zv-ft-steps" data-steps>
        {caso.steps.map((s, i) => (
          <li key={i} data-at={caso.marks[i]}>
            <span className="zv-list-n">{pad(i + 1)}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <p className="zv-caso-done" data-done>
        <span className="zv-caso-check" aria-hidden="true">
          ✓
        </span>
        {caso.done}
      </p>
      <p className="zv-ft-note">Conversación de demostración · negocio ficticio «{caso.name}».</p>
    </div>
  )
  return (
    <section
      id={caso.id}
      className={`zv-sec zv-foodtruck zv-caso${flip ? ' zv-caso--flip' : ''}`}
      data-section={caso.id}
      data-caso
      aria-labelledby={`${caso.id}-title`}
    >
      <div className="zv-col zv-col--wide">
        <SectionHead id={`${caso.id}-title`} n={caso.tag} label={caso.label} title={caso.title} accent={caso.accent} intro={caso.intro} big />
        <div className="zv-ft-grid" data-reveal>
          {flip ? (
            <>
              {side}
              {phone}
            </>
          ) : (
            <>
              {phone}
              {side}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function Integraciones() {
  return (
    <section id="integraciones" className="zv-sec zv-integra" data-section="integraciones" aria-labelledby="zv-integra-title">
      <div className="zv-col zv-col--wide">
        <SectionHead
          id="zv-integra-title"
          n="∞"
          label="Se conecta con lo que ya usas"
          title="Toda tu operación, dentro del chat."
          accent={[2]}
          intro="Hoy atiende por WhatsApp e Instagram, e importa tu catálogo desde WooCommerce o Jumpseller. Estas son las demás integraciones que vienen, para que el agente agende, cobre y venda sin que tu cliente salga de la conversación."
        />
        <ul className="zv-integra-grid" data-reveal>
          {INTEGRATIONS.map((it) => (
            <li key={it.name} className="zv-integra-card" data-reveal-item data-tilt data-status={it.status}>
              <div className="zv-tilt">
                <span className="zv-integra-ico" aria-hidden="true">
                  {it.emoji}
                </span>
                <div className="zv-integra-body">
                  <p className="zv-integra-name">
                    {it.name}
                    <span className={`zv-integra-badge zv-integra-badge--${it.status}`}>
                      {it.status === 'live' ? 'Ya conectas' : 'En camino'}
                    </span>
                  </p>
                  <p className="zv-integra-text">{it.text}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <p className="zv-integra-note" data-reveal-item>
          ¿Usas otra herramienta? Escríbenos y la sumamos a la lista.
        </p>
      </div>
    </section>
  )
}

function Empieza() {
  return (
    <section id="empieza" className="zv-sec zv-empieza" data-section="empieza" aria-labelledby="zv-empieza-title">
      <div className="zv-col zv-col--wide">
        <SectionHead id="zv-empieza-title" n="09" label="Cómo empieza" title="Listo para esta noche, en cuatro pasos." />
        <ol className="zv-steps" data-reveal>
          {STEPS.map((s, i) => (
            <li key={s.title} className="zv-step" data-reveal-item data-tilt>
              <div className="zv-tilt">
                <span className="zv-step-n">{pad(i + 1)}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Final() {
  return (
    <section id="final" className="zv-sec zv-final" data-section="final" aria-labelledby="zv-final-title">
      <div className="zv-col" data-reveal>
        <p className="zv-label" data-reveal-item>
          <span>10</span> — Esta noche
        </p>
        <h2 id="zv-final-title" className="zv-h2 zv-h2--xl">
          <SplitWords text="Que ningún cliente más quede en visto." accent={[6]} />
        </h2>
        <p className="zv-intro" data-reveal-item>
          Crea tu agente en minutos y pruébalo en el simulador antes de conectar tus canales.
        </p>
        <div className="zv-cta-row" data-reveal-item>
          <Link href="/registro" className="zv-btn" data-magnetic data-cursor="Empezar">
            Probar gratis <span aria-hidden="true">↗</span>
          </Link>
          <Link href="/panel" className="zv-btn zv-btn--ghost" data-magnetic data-cursor="Entrar">
            Ya tengo cuenta
          </Link>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="zv-foot">
      <p className="zv-foot-word" aria-hidden="true">
        ZEROVISTO
      </p>
      <div className="zv-foot-row">
        <span className="zv-label">
          {BRAND.name} · {BRAND.tagline}
        </span>
        <nav aria-label="Legal" className="zv-foot-nav">
          <Link href="/terminos">Términos</Link>
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/panel">Ingresar</Link>
        </nav>
        <span className="zv-foot-c">
          &copy; {new Date().getFullYear()} {BRAND.name} · Hecho en Chile
        </span>
      </div>
    </footer>
  )
}

export default function Home() {
  return (
    <div className="zv">
      <a href="#contenido" className="zv-skip">
        Saltar al contenido
      </a>
      <Preloader />
      <World />
      {/* La palabra gigante vive en el mundo: detrás de los primeros planos y del texto */}
      <p className="zv-giant" aria-hidden="true">
        <span className="zv-giant-s" data-giant>
          <span className="zv-giant-in">ZEROVISTO</span>
        </span>
      </p>
      <Foreground />
      {/* Sombras de legibilidad pegadas a la pantalla: se funden con el scroll, sin bordes que entren deslizándose */}
      <div className="zv-shades" aria-hidden="true">
        <div className="zv-shade zv-shade--stage" data-shade="noche" />
        <div className="zv-shade zv-shade--left" data-shade="rubros" />
        <div className="zv-shade zv-shade--right" data-shade="negocios" />
      </div>
      <Nav />
      <Rail />
      <main id="contenido">
        <Hero />
        <div id="noche" data-section="noche">
          <Stage />
          <StaticStory />
        </div>
        <Rubros />
        {CASES.map((caso, i) => (
          <Caso key={caso.id} caso={caso} index={i} />
        ))}
        <Negocios />
        <Limites />
        <Integraciones />
        <Empieza />
        <Final />
      </main>
      <Footer />
      <Pointer />
      <Motion />
    </div>
  )
}
