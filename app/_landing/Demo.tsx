import QRCode from 'qrcode'
import { COMPANY_SALES_LIVE, COMPANY_SALES_WHATSAPP, COMPANY_WHATSAPP_URL } from '@/lib/legal'
import { DEMO_BOTS, MEASURED, waLink } from './resultados'

/**
 * La prueba que no se puede fingir: el visitante le escribe al agente desde su
 * propio WhatsApp. En el celular abre el chat; en el computador, el QR lo lleva
 * al celular, que es donde de verdad va a usarlo su cliente.
 */
export default async function Demo() {
  const bots = await Promise.all(
    DEMO_BOTS.map(async (bot) => ({
      bot,
      href: waLink(bot),
      qr: await QRCode.toString(waLink(bot), {
        type: 'svg',
        margin: 0,
        errorCorrectionLevel: 'M',
        color: { dark: '#efe7d8', light: '#00000000' },
      }),
    })),
  )

  return (
    <section id="demo" className="zv-sec zv-envivo" data-section="demo" aria-labelledby="zv-demo-title">
      <div className="zv-col zv-col--wide">
        <header className="zv-head">
          <p className="zv-label">
            <span>▶</span> — En vivo, ahora mismo
          </p>
          <h2 id="zv-demo-title" className="zv-h2">
            No nos creas. <em>Escríbele.</em>
          </h2>
          <p className="zv-intro">
            Estos tres negocios de demostración están conectados de verdad y los atiende el mismo
            agente que vas a tener tú. Escríbeles desde tu WhatsApp, a la hora que sea, y mira cómo
            responde, agenda y reserva.
          </p>
        </header>

        <ul className="zv-demo-grid" data-reveal>
          {bots.map(({ bot, href, qr }) => (
            <li key={bot.id} className="zv-demo-card" data-reveal-item>
              <div className="zv-demo-top">
                <span className="zv-demo-emoji" aria-hidden="true">
                  {bot.emoji}
                </span>
                <div>
                  <h3 className="zv-demo-name">{bot.name}</h3>
                  <p className="zv-demo-rubro">{bot.rubro}</p>
                </div>
                <span className="zv-demo-live">
                  <i aria-hidden="true" /> En línea
                </span>
              </div>

              <p className="zv-demo-try-k">Pruébale esto:</p>
              <ul className="zv-demo-try">
                {bot.tryIt.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>

              <div className="zv-demo-bottom">
                <div
                  className="zv-demo-qr"
                  role="img"
                  aria-label={`Código QR para escribirle a ${bot.name} por WhatsApp`}
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
                <div className="zv-demo-actions">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="zv-btn zv-btn--sm"
                    data-magnetic
                    data-cursor="WhatsApp"
                  >
                    Escribirle <span aria-hidden="true">↗</span>
                  </a>
                  <p className="zv-demo-phone">{bot.phone}</p>
                  <p className="zv-demo-hint">Desde el computador, escanea el código con tu celular.</p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <p className="zv-demo-measure" data-reveal>
          <strong>{MEASURED.medianSeconds} segundos</strong> es lo que tarda en responder, en la
          mitad de los casos: medido sobre {MEASURED.sample} respuestas reales de estos agentes (
          {MEASURED.measuredOn}). Una persona ocupada tarda horas, o no contesta.
        </p>

        {COMPANY_SALES_LIVE && (
          <p className="zv-demo-sales" data-reveal>
            ¿Quieres saber cuánto te costaría o si sirve para tu rubro? Nuestras ventas también las
            atiende un agente de ZeroVisto:{' '}
            <a href={COMPANY_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" data-cursor="WhatsApp">
              escríbele al {COMPANY_SALES_WHATSAPP} ↗
            </a>
          </p>
        )}
      </div>
    </section>
  )
}
