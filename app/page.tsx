import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { COMPANY, COMPANY_PHONE_URL, COMPANY_SALES_LIVE, COMPANY_SALES_WHATSAPP, COMPANY_WHATSAPP_URL } from '@/lib/legal'
import Foreground from './_landing/Foreground'
import Motion from './_landing/Motion'
import Nav from './_landing/Nav'
import Pointer from './_landing/Pointer'
import Preloader from './_landing/Preloader'
import Rail from './_landing/Rail'
import Stage, { SplitWords } from './_landing/Stage'
import StaticStory from './_landing/Static'
import World from './_landing/World'
import Ahorro from './_landing/Ahorro'
import Mesas from './_landing/Mesas'
import Demo from './_landing/Demo'
import Ticker from './_landing/Ticker'
import Precios from './_landing/Precios'
import { CasoPhone, CasoSteps } from './_landing/CasoParts'
import { BENEFITS, CASES, FACTS, GUARDRAILS, INTEGRATIONS, LOSS_CAUSES, LOSS_FIX, MULTI, STEPS, STREET } from './_landing/data'
import { MEASURED } from './_landing/resultados'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/fraunces/index.css'
import '@fontsource-variable/fraunces/wght-italic.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import './_landing/landing.css'

const pad = (n: number) => String(n).padStart(2, '0')

function SectionHead({ id, n, label, title, intro, accent = [], breakAfter = [], big = false }: { id: string; n: string; label: string; title: string; intro?: string; accent?: number[]; breakAfter?: number[]; big?: boolean }) {
  return (
    <header className={`zv-head${big ? ' zv-head--big' : ''}`} data-reveal>
      <p className="zv-label" data-reveal-item>
        <span>{n}</span> — {label}
      </p>
      <h2 id={id} className={`zv-h2${big ? ' zv-h2--case' : ''}`}>
        <SplitWords text={title} accent={accent} breakAfter={breakAfter} />
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
              <span>00</span> — Atención con IA para WhatsApp e Instagram
            </p>
            <h1 id="zv-hero-title" className="zv-h1">
              <SplitWords text="Más horas agendadas. Cero clientes en visto." accent={[2, 6]} breakAfter={[2]} />
            </h1>
          </div>
          <div className="zv-hero-side">
            <p className="zv-lead">
              Cuando nadie contesta —porque estás ocupado o ya cerraste—, tu cliente le escribe a otro local. Con
              ZeroVisto tu WhatsApp e Instagram contestan en segundos, <strong>24/7</strong>: agendan horas, reservan
              mesas y toman pedidos aunque tu local esté cerrado.
            </p>
            <div className="zv-cta-row">
              <a href="#demo" className="zv-btn" data-magnetic data-cursor="Probar">
                Pruébalo en tu WhatsApp <span aria-hidden="true">↓</span>
              </a>
              <a href="#precios" className="zv-btn zv-btn--ghost" data-magnetic data-cursor="Ver">
                Ver precios
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

/**
 * El porqué, antes de la demo y de la noche: el cliente que no recibe respuesta
 * (por lentitud o por horario) se va con otro, y el agente lo evita atendiendo 24/7.
 */
function Porque() {
  return (
    <section id="porque" className="zv-sec zv-porque" data-section="porque" aria-labelledby="zv-porque-title">
      <div className="zv-col zv-col--wide">
        <SectionHead
          id="zv-porque-title"
          n="!"
          label="Por qué se te van los clientes"
          title="Si no contestas, le escriben al de al lado."
          accent={[3, 4, 5, 6, 7, 8]}
          breakAfter={[2]}
          intro="Quien escribe por WhatsApp quiere respuesta ahora. Si no la recibe, no espera: le escribe a otro negocio y se queda con el primero que contesta. Cada mensaje sin responder es un cliente que se va con tu competencia."
        />
        <ul className="zv-porque-grid" data-reveal>
          {LOSS_CAUSES.map((c) => (
            <li key={c.title} className="zv-porque-card" data-reveal-item>
              <span className="zv-porque-icon" aria-hidden="true">
                {c.icon}
              </span>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </li>
          ))}
          <li className="zv-porque-card zv-porque-card--fix" data-reveal-item>
            <span className="zv-porque-icon" aria-hidden="true">
              {LOSS_FIX.icon}
            </span>
            <h3>{LOSS_FIX.title}</h3>
            <p>{LOSS_FIX.text}</p>
          </li>
        </ul>
        <div className="zv-247" data-reveal>
          <p className="zv-247-v" data-reveal-item>
            24/7
          </p>
          <p className="zv-247-t" data-reveal-item>
            Tu agente no duerme, no sale a almorzar y no se toma feriados. Responde en{' '}
            <strong>{MEASURED.medianSeconds} segundos</strong> (mediana medida en respuestas reales), a las 3 de la
            tarde o a las 3 de la mañana.
          </p>
        </div>
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
            title="Sirve para tu negocio, sea cual sea."
            intro="Uñas, dentistas, talleres, restaurantes… Cada negocio parte con su plantilla: el agente ya sabe qué preguntar en tu rubro. Tú solo ajustas."
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
          title="Tranquilo: no inventa ni se manda solo."
          intro="Si no sabe algo, lo dice. Si el cliente reclama, te lo pasa. Un agente que atiende a las once de la noche tiene que saber cuándo parar, y este ya viene así."
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

// Los dos casos usan el mismo orden (teléfono a la izquierda): la derecha queda
// libre para su escena 3D, el carro con Nico o la clínica con Camila.
function Caso({ caso }: { caso: (typeof CASES)[number] }) {
  const phone = <CasoPhone caso={caso} />
  const side = <CasoSteps caso={caso} />
  return (
    <section
      id={caso.id}
      className={`zv-sec zv-caso zv-${caso.id}`}
      data-section={caso.id}
      data-caso
      aria-labelledby={`${caso.id}-title`}
    >
      <div className="zv-col zv-col--wide">
        <SectionHead id={`${caso.id}-title`} n={caso.tag} label={caso.label} title={caso.title} accent={caso.accent} intro={caso.intro} big />
        <div className="zv-ft-grid" data-reveal>
          {phone}
          {side}
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
          intro="Atiende por WhatsApp e Instagram, entiende las notas de voz, importa tu catálogo desde WooCommerce o Jumpseller y reserva mesas en tu restaurante, sin que tu cliente salga de la conversación."
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
          ¿Usas otra herramienta? Escríbenos y vemos cómo conectarla.
        </p>
      </div>
    </section>
  )
}

function Resuelve() {
  return (
    <section id="ahorro" className="zv-sec zv-ahorro" data-section="ahorro" aria-labelledby="zv-ahorro-title">
      <div className="zv-col zv-col--wide">
        <SectionHead
          id="zv-ahorro-title"
          n="$"
          label="Lo que resuelve"
          title="Menos horas contestando. Más tiempo para tu negocio."
          accent={[4]}
          intro="Cada pregunta que el agente contesta solo es tiempo que tu equipo recupera. Esto es lo que resuelve en el día a día, y abajo, la cuenta con tus propios números."
          big
        />
        <ul className="zv-benefit-grid" data-reveal>
          {BENEFITS.map((b) => (
            <li key={b.title} className="zv-benefit" data-reveal-item>
              <span className="zv-benefit-ico" aria-hidden="true">
                {b.emoji}
              </span>
              <h3 className="zv-benefit-title">{b.title}</h3>
              <p className="zv-benefit-text">{b.text}</p>
            </li>
          ))}
        </ul>
        <div data-reveal>
          <Ahorro />
        </div>
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
          Escríbele a uno de nuestros bots y compruébalo en tu WhatsApp. Si te convence, dejamos el tuyo
          funcionando en tu número.
        </p>
        <div className="zv-cta-row" data-reveal-item>
          <a href="#demo" className="zv-btn" data-magnetic data-cursor="Probar">
            Probar un bot ahora <span aria-hidden="true">↑</span>
          </a>
          <a href={COMPANY_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="zv-btn zv-btn--ghost" data-magnetic data-cursor="Contratar">
            Contratar
          </a>
          <Link href="/panel" className="zv-btn zv-btn--ghost" data-magnetic data-cursor="Entrar">
            Ya tengo cuenta
          </Link>
        </div>
        <div className="zv-contact" data-reveal-item>
          <p>¿Dudas sobre precios o si sirve para tu negocio?</p>
          {COMPANY_SALES_LIVE && (
            <a href={COMPANY_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" data-cursor="WhatsApp">
              <span aria-hidden="true">💬</span> Pregúntale a nuestro agente: WhatsApp {COMPANY_SALES_WHATSAPP}
            </a>
          )}
          <a href={COMPANY_PHONE_URL} data-cursor="Llamar">
            <span aria-hidden="true">📞</span> Llámanos al {COMPANY.phone}
          </a>
          <a href={`mailto:${COMPANY.email}`} data-cursor="Correo">
            <span aria-hidden="true">✉️</span> {COMPANY.email}
          </a>
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
        <nav aria-label="Contacto y legal" className="zv-foot-nav">
          {COMPANY_SALES_LIVE && (
            <a href={COMPANY_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              WhatsApp ventas {COMPANY_SALES_WHATSAPP}
            </a>
          )}
          <a href={COMPANY_PHONE_URL}>Teléfono {COMPANY.phone}</a>
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
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
        <Ticker />
        <Porque />
        <Demo />
        <div id="noche" data-section="noche">
          <Stage />
          <StaticStory />
        </div>
        <Rubros />
        {CASES.map((caso) => (
          <Caso key={caso.id} caso={caso} />
        ))}
        <Negocios />
        <Limites />
        <Integraciones />
        <Mesas />
        <Resuelve />
        <Precios />
        <Empieza />
        <Final />
      </main>
      <Footer />
      <Pointer />
      <Motion />
    </div>
  )
}
