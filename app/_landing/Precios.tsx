import { COMPANY_WHATSAPP_URL } from '@/lib/legal'
import {
  BUSINESS_LIMIT,
  PAID_PLANS,
  PLAN_LABEL,
  PLAN_MONTHLY_CLP,
  SETUP_FEE_BY_TIER,
  SETUP_FEE_EXTRA_CLP,
  SETUP_TIER_DESC,
  SETUP_TIER_EXAMPLE,
  SETUP_TIER_LABEL,
  SETUP_TIER_ORDER,
  type PaidPlan,
} from '@/lib/plans'
import { monthlyLimit } from '@/lib/planLimits'

const clp = (n: number) => `$${n.toLocaleString('es-CL')}`

/** Valor de ejemplo de una hora agendada o un pedido, para la cuenta de cuándo se paga solo. */
const TICKET_EJEMPLO = 20_000

const PITCH: Record<PaidPlan, string> = {
  BASICO: 'Para un local que quiere dejar de perder clientes en visto.',
  NEGOCIOS: 'Para quien maneja más de un local o marca.',
  ILIMITADO: 'Para agencias y cadenas con muchos negocios.',
}

/** El nivel que más se contrata: se destaca para que el cliente tenga un punto de partida. */
const COMMON_TIER = 'ESTANDAR' as const

/**
 * Precios a la vista: esconderlos detrás de un registro frena la venta. Los
 * montos salen de lib/plans.ts y los cupos de lib/usage.ts, los mismos que
 * cobra y aplica el sistema, para que la landing nunca prometa otra cosa.
 *
 * Dos números y nada más por tarjeta: lo que se paga al mes y lo que se paga una
 * vez al empezar. El detalle de la implementación va aparte, con ejemplos de
 * negocios reales para que cada uno se ubique sin saber de "canales".
 */
export default function Precios() {
  const example = { plan: 'BASICO' as const, tier: COMMON_TIER }
  return (
    <section id="precios" className="zv-sec zv-precios" data-section="precios" aria-labelledby="zv-precios-title">
      <div className="zv-col zv-col--wide">
        <header className="zv-head">
          <p className="zv-label">
            <span>$</span> — Precios
          </p>
          <h2 id="zv-precios-title" className="zv-h2">
            Se paga solo con <em>tres clientes</em> al mes.
          </h2>
          <p className="zv-intro">
            Pagas una mensualidad y, una sola vez al empezar, la implementación: te lo dejamos funcionando. Si cada
            hora agendada o pedido te deja {clp(TICKET_EJEMPLO)}, el plan Básico se paga con{' '}
            {Math.ceil(PLAN_MONTHLY_CLP.BASICO / TICKET_EJEMPLO)} clientes que antes se perdían.{' '}
            <a href="#ahorro">Haz la cuenta con tus números</a>.
          </p>
        </header>

        <ul className="zv-price-grid" data-reveal>
          {PAID_PLANS.map((plan) => {
            const negocios = BUSINESS_LIMIT[plan]
            const respuestas = monthlyLimit(plan)
            const featured = plan === 'BASICO'
            return (
              <li key={plan} className={`zv-price${featured ? ' zv-price--featured' : ''}`} data-reveal-item>
                {featured && <span className="zv-price-badge">Recomendado para empezar</span>}
                <h3 className="zv-price-name">{PLAN_LABEL[plan]}</h3>
                <p className="zv-price-pitch">{PITCH[plan]}</p>
                <p className="zv-price-amount">
                  {clp(PLAN_MONTHLY_CLP[plan])}
                  <span>/mes</span>
                </p>
                <p className="zv-price-iva">IVA incluido · sin permanencia</p>
                <p className="zv-price-setup">
                  + implementación desde {clp(SETUP_FEE_BY_TIER.SIMPLE)}
                  <span>
                    pago único al empezar
                    {negocios !== 1 && ` · cada local extra ${clp(SETUP_FEE_EXTRA_CLP)}`}
                  </span>
                </p>
                <ul className="zv-price-list">
                  <li>{negocios === null ? 'Negocios sin límite' : negocios === 1 ? '1 negocio' : `Hasta ${negocios} negocios`}</li>
                  <li>
                    {respuestas === null ? 'Respuestas sin límite' : `${respuestas.toLocaleString('es-CL')} respuestas del agente al mes`}
                  </li>
                  <li>Atiende 24/7: noches, fines de semana y feriados</li>
                  <li>Agenda, reservas de mesa, pedidos y notas de voz</li>
                  <li>WhatsApp e Instagram en un solo panel</li>
                </ul>
                <a
                  href={COMPANY_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`zv-btn${featured ? '' : ' zv-btn--ghost'}`}
                  data-magnetic
                  data-cursor="Contratar"
                >
                  Contratar <span aria-hidden="true">↗</span>
                </a>
              </li>
            )
          })}
        </ul>

        <div className="zv-setup" data-reveal>
          <div className="zv-setup-intro" data-reveal-item>
            <p className="zv-setup-k">Implementación · se paga una sola vez</p>
            <h3 className="zv-setup-title">¿Cuánto cuesta dejarlo funcionando?</h3>
            <p className="zv-setup-lead">
              Depende de lo que tu agente tenga que hacer. Ubica tu negocio en una de estas tres opciones; si tienes
              dudas, te decimos cuál te corresponde antes de contratar, sin sorpresas.
            </p>
            <ul className="zv-setup-list">
              <li>Conectamos tu WhatsApp y lo dejamos verificado ante Meta.</li>
              <li>Cargamos tu carta o servicios, precios, horarios y preguntas frecuentes.</li>
              <li>Lo probamos contigo antes de que hable con tus clientes.</li>
            </ul>
          </div>

          <ol className="zv-setup-tiers" data-reveal-item>
            {SETUP_TIER_ORDER.map((tier) => (
              <li key={tier} className={`zv-setup-tier${tier === COMMON_TIER ? ' zv-setup-tier--common' : ''}`}>
                {tier === COMMON_TIER && <span className="zv-setup-tier-badge">El más común</span>}
                <p className="zv-setup-tier-name">{SETUP_TIER_LABEL[tier]}</p>
                <p className="zv-setup-tier-price">{clp(SETUP_FEE_BY_TIER[tier])}</p>
                <p className="zv-setup-tier-desc">{SETUP_TIER_DESC[tier]}</p>
                <p className="zv-setup-tier-ex">Ej.: {SETUP_TIER_EXAMPLE[tier]}</p>
              </li>
            ))}
          </ol>

          <div className="zv-setup-foot" data-reveal-item>
            <p>
              <strong>¿Más de un local?</strong> Cada local adicional suma {clp(SETUP_FEE_EXTRA_CLP)}: reutilizamos tu
              configuración y solo cargamos lo propio de ese local.
            </p>
            <p className="zv-setup-example">
              <strong>Ejemplo:</strong> un food truck en plan {PLAN_LABEL[example.plan]} paga{' '}
              {clp(SETUP_FEE_BY_TIER[example.tier])} una vez al empezar y después {clp(PLAN_MONTHLY_CLP[example.plan])} al
              mes. Nada más.
            </p>
          </div>
        </div>

        <div className="zv-price-notes zv-precios-notes" data-reveal>
          <p data-reveal-item>
            <strong>Antes de contratar, pruébalo:</strong> escríbele a nuestros{' '}
            <a href="#demo">bots en vivo</a> y mira cómo atenderían a tus clientes.
          </p>
          <p data-reveal-item>
            <strong>Sin permanencia:</strong> cancelas cuando quieras desde tu cuenta y sigues usándolo hasta el final del mes ya pagado.
          </p>
        </div>
      </div>
    </section>
  )
}
