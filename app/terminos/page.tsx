import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { COMPANY, COMPANY_ADDRESS } from '@/lib/legal'
import LegalLayout from '../LegalLayout'

export const metadata = { title: `Términos de servicio — ${BRAND.name}` }

export default function TerminosPage() {
  return (
    <LegalLayout title="Términos de servicio" updated={COMPANY.updated}>
      <h2>1. Quiénes somos</h2>
      <p>
        {BRAND.name} es operado por <strong>{COMPANY.legalName}</strong>, RUT {COMPANY.rut}, con
        domicilio en {COMPANY_ADDRESS}. Consultas sobre estos términos:{' '}
        <a href={`mailto:${COMPANY.email}`} className="text-amber-400 hover:underline">
          {COMPANY.email}
        </a>
        .
      </p>

      <h2>2. Qué es el servicio</h2>
      <p>
        {BRAND.name} es una plataforma que permite crear un agente de atención automatizado,
        impulsado por modelos de lenguaje de terceros, para responder mensajes de WhatsApp,
        Instagram y otros canales en nombre de un negocio, además de gestionar conversaciones,
        horas agendadas, catálogo y pedidos.
      </p>

      <h2>3. Tu cuenta</h2>
      <ul>
        <li>
          Eres responsable de mantener la confidencialidad de tu contraseña y de toda la actividad
          que ocurra en tu cuenta.
        </li>
        <li>
          Eres responsable de la información que cargas en la base de conocimiento y de las
          respuestas que el agente termina enviando a tus clientes en tu nombre. Revísalas antes de
          conectar un canal real.
        </li>
        <li>
          Los datos de tu negocio son tuyos. Puedes exportarlos o pedir que se eliminen en
          cualquier momento.
        </li>
      </ul>

      <h2>4. Lo que no se puede hacer</h2>
      <ul>
        <li>Enviar mensajes masivos no solicitados a personas que no aceptaron recibirlos.</li>
        <li>Suplantar a otra persona, empresa o marca.</li>
        <li>
          Ofrecer por este medio productos o servicios prohibidos por las políticas de comercio de
          Meta, como drogas, armas, tabaco, suplementos sujetos a receta o apuestas sin
          autorización.
        </li>
        <li>
          Usar el agente para dar consejo médico, legal o financiero presentándolo como si lo diera
          un profesional.
        </li>
        <li>Intentar vulnerar la seguridad de la plataforma o acceder a datos de otro negocio.</li>
      </ul>
      <p>
        El incumplimiento puede terminar en la suspensión de la cuenta, y en el bloqueo del número
        por parte de Meta, que es una decisión de Meta y no nuestra.
      </p>

      <h2>5. Obligaciones con tus propios clientes</h2>
      <p>Al conectar un canal a {BRAND.name} te comprometes a:</p>
      <ul>
        <li>
          Haber obtenido el consentimiento de las personas a las que les vas a escribir, como lo
          exige WhatsApp, y poder acreditarlo.
        </li>
        <li>Cumplir las políticas comerciales y de mensajería de Meta.</li>
        <li>
          Avisar a tus clientes que la atención puede ser automatizada y atender sus pedidos sobre
          sus datos personales, que eres tú quien decide.
        </li>
      </ul>

      <h2>6. Datos de tus clientes</h2>
      <p>
        Los datos de las personas que le escriben a tu negocio los tratamos <strong>por tu
        cuenta</strong> y siguiendo tus instrucciones: tú eres el responsable del tratamiento y
        nosotros el encargado. En concreto, nos obligamos a usarlos solo para prestarte el
        servicio, a no cederlos a terceros fuera de los proveedores listados en la{' '}
        <Link href="/privacidad" className="text-amber-400 hover:underline">
          Política de Privacidad
        </Link>
        , a mantenerlos con medidas de seguridad razonables, a avisarte sin demora si ocurre un
        incidente que los afecte, y a devolverlos o eliminarlos cuando termine el servicio.
      </p>

      <h2>7. Planes y facturación</h2>
      <p>
        El plan gratuito incluye hasta 300 respuestas del agente por mes y por negocio. El plan PRO
        incluye hasta 5.000. Al llegar al tope el agente deja de responder de forma automática y
        avisa que una persona va a contestar; las conversaciones y el panel siguen funcionando.
      </p>
      <p>
        El plan PRO se cobra por mes a través de Stripe, al precio informado al contratar, y se
        puede cancelar cuando quieras desde &laquo;Mi cuenta&raquo;. La cancelación aplica al final
        del período ya pagado, sin devoluciones proporcionales. Si cambian los precios, se avisa
        con 30 días de anticipación y el cambio rige en el período siguiente.
      </p>

      <h2>8. Qué no garantizamos</h2>
      <p>
        El agente responde con inteligencia artificial y <strong>puede equivocarse o dar
        información desactualizada</strong>. Revisa lo que publica, sobre todo precios, stock y
        horarios. No garantizamos disponibilidad ininterrumpida ni el funcionamiento de servicios
        de terceros de los que dependemos, como Meta, el proveedor de inteligencia artificial o la
        pasarela de pagos.
      </p>
      <p>
        Tampoco controlamos los plazos ni las decisiones de Meta sobre la verificación de un
        negocio, la aprobación de un número o el bloqueo de una cuenta.
      </p>

      <h2>9. Responsabilidad</h2>
      <p>
        Respondemos por los daños directos que causemos, con un tope igual a lo que hayas pagado
        por el servicio en los 12 meses anteriores al hecho. No respondemos por lucro cesante ni
        por daños indirectos. Nada de esto limita los derechos que la ley chilena reconoce a los
        consumidores ni la responsabilidad por dolo o culpa grave.
      </p>

      <h2>10. Término del servicio</h2>
      <p>
        Puedes dejar de usar {BRAND.name} cuando quieras. Podemos suspender una cuenta que incumpla
        estos términos o que ponga en riesgo la plataforma, avisando antes salvo que el riesgo
        obligue a actuar de inmediato. Al cerrar la cuenta tienes 30 días para pedir tus datos,
        después de los cuales se eliminan.
      </p>

      <h2>11. Cambios</h2>
      <p>
        Podemos actualizar estos términos. Los cambios importantes se avisan por mail o dentro del
        panel con 15 días de anticipación; seguir usando el servicio después de esa fecha implica
        aceptarlos.
      </p>

      <h2>12. Ley aplicable</h2>
      <p>
        Estos términos se rigen por las leyes de la República de Chile. Cualquier controversia se
        somete a los tribunales ordinarios de justicia de la comuna de {COMPANY.city}, sin
        perjuicio del derecho del consumidor a recurrir ante el tribunal que le corresponda.
      </p>
    </LegalLayout>
  )
}
