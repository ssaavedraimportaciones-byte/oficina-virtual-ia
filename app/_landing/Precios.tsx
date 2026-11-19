import { COMPANY_WHATSAPP_URL } from '@/lib/legal'
import { BUSINESS_LIMIT, PAID_PLANS, PLAN_LABEL, PLAN_MONTHLY_CLP, SETUP_FEE_CLP, SETUP_FEE_EXTRA_CLP, type PaidPlan } from '@/lib/plans'
import { monthlyLimit } from '@/lib/planLimits'

const clp = (n: number) => `$${n.toLocaleString('es-CL')}`

/** Valor de ejemplo de una hora agendada o un pedido, para la cuenta de cuándo se paga solo. */
const TICKET_EJEMPLO = 20_000

const PITCH: Record<PaidPlan, string> = {
  BASICO: 'Para un local que quiere dejar de perder clientes en visto.',
  NEGOCIOS: 'Para quien maneja más de un local o marca.',
  ILIMITADO: 'Para agencias y cadenas con muchos negocios.',
}

/**
 * Precios a la vista: esconderlos detrás de un registro frena la venta. Los
 * montos salen de lib/plans.ts y los cupos de lib/usage.ts, los mismos que
 * cobra y aplica el sistema, para que la landing nunca prometa otra cosa.
 */
export default function Precios() {
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
            Si cada hora agendada o pedido te deja {clp(TICKET_EJEMPLO)}, el plan Básico se paga con{' '}
            {Math.ceil(PLAN_MONTHLY_CLP.BASICO / TICKET_EJEMPLO)} clientes que antes se perdían
            esperando respuesta. Todo lo demás es ganancia. Haz la cuenta con tus propios números{' '}
            <a href="#ahorro">en la calculadora</a>.
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
                <p className="zv-price-iva">IVA incluido</p>
                <p className="zv-price-setup">
                  + {clp(SETUP_FEE_CLP)} de implementación, una vez
                  <span>{negocios === 1 ? 'pago único' : `cada local adicional: ${clp(SETUP_FEE_EXTRA_CLP)}`}</span>
                </p>
                <ul className="zv-price-list">
                  <li>{negocios === null ? 'Negocios sin límite' : negocios === 1 ? '1 negocio' : `Hasta ${negocios} negocios`}</li>
                  <li>
                    {respuestas === null ? 'Respuestas sin límite' : `${respuestas.toLocaleString('es-CL')} respuestas del agente al mes`}
                  </li>
                  <li>Se paga solo con {Math.ceil(PLAN_MONTHLY_CLP[plan] / TICKET_EJEMPLO)} clientes al mes</li>
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
          <div className="zv-setup-amount" data-reveal-item>
            <p className="zv-setup-k">Implementación · pago único</p>
            <p className="zv-setup-v">{clp(SETUP_FEE_CLP)}</p>
            <p className="zv-setup-s">tu primer local · IVA incluido</p>
            <p className="zv-setup-v2">
              + {clp(SETUP_FEE_EXTRA_CLP)} <span>cada local adicional</span>
            </p>
          </div>
          <div data-reveal-item>
            <p className="zv-setup-lead">Te lo dejamos funcionando, no te pasamos un programa para que te arregles solo:</p>
            <ul className="zv-setup-list">
              <li>Conectamos tu WhatsApp Business y lo dejamos verificado ante Meta.</li>
              <li>Cargamos tu negocio: servicios o carta, precios, horarios y preguntas frecuentes.</li>
              <li>Probamos al agente contigo antes de que hable con tus clientes.</li>
              <li>
                ¿Más locales? Cada uno suma {clp(SETUP_FEE_EXTRA_CLP)}: reutilizamos tu configuración y solo cargamos lo
                propio de ese local (su número, su carta o su agenda).
              </li>
            </ul>
            <p className="zv-setup-note">
              Un agente con IA hecho a medida suele costar desde $300.000 en Chile. Esta implementación se recupera con unos{' '}
              {Math.ceil(SETUP_FEE_CLP / TICKET_EJEMPLO)} clientes que antes se perdían, y se paga una sola vez.
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
