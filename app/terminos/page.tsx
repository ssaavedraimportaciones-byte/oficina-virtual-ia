import LegalLayout from '../LegalLayout'

export const metadata = { title: 'Términos de servicio — AgentsApp' }

export default function TerminosPage() {
  return (
    <LegalLayout title="Términos de servicio" updated="[completar fecha de publicación]">
      <h2>1. Quiénes somos</h2>
      <p>
        AgentsApp es operado por [RAZÓN SOCIAL / NOMBRE DEL TITULAR], [CUIT/NIF/identificación
        fiscal], con domicilio en [DOMICILIO]. Para cualquier consulta sobre estos términos,
        escribinos a [EMAIL DE CONTACTO].
      </p>

      <h2>2. Qué es el servicio</h2>
      <p>
        AgentsApp es una plataforma que permite crear un agente de atención automatizado
        (impulsado por modelos de lenguaje de terceros, como Anthropic u OpenAI) para responder
        mensajes de WhatsApp, Instagram y otros canales en nombre de un negocio, además de
        gestionar conversaciones, turnos, catálogo y pedidos.
      </p>

      <h2>3. Cuenta y responsabilidad del contenido</h2>
      <ul>
        <li>
          Sos responsable de mantener la confidencialidad de tu contraseña y de toda la actividad
          que ocurra en tu cuenta.
        </li>
        <li>
          Sos responsable de la información que cargás en la base de conocimiento del agente y de
          las respuestas que el agente termina enviando a tus clientes en tu nombre: revisalas
          antes de darle a tu agente acceso a canales reales.
        </li>
        <li>No está permitido usar la plataforma para enviar spam, contenido ilegal, ni suplantar identidades.</li>
      </ul>

      <h2>4. Planes y facturación</h2>
      <p>
        El plan gratuito incluye [DETALLAR LÍMITES: p. ej. un negocio, X conversaciones/mes]. El
        plan pago (PRO) se cobra [PERIODICIDAD] a través de Stripe y se puede cancelar en
        cualquier momento desde la sección "Mi cuenta"; la cancelación aplica [al final del
        período ya pago / de forma inmediata — DEFINIR].
      </p>

      <h2>5. Disponibilidad y límites del agente automatizado</h2>
      <p>
        El agente responde usando inteligencia artificial y puede cometer errores o dar
        información desactualizada. No garantizamos disponibilidad ininterrumpida del servicio ni
        de los proveedores de mensajería (Meta/WhatsApp, Instagram) o del modelo de lenguaje
        utilizado.
      </p>

      <h2>6. Datos de tus clientes</h2>
      <p>
        Al usar AgentsApp para atender a tus propios clientes, sos vos (el titular del negocio)
        quien decide qué datos de esos clientes se procesan por este medio. Ver la{' '}
        <a href="/privacidad" className="text-amber-400 hover:underline">
          Política de Privacidad
        </a>{' '}
        para el detalle de qué se guarda y con qué terceros se comparte (Anthropic/OpenAI para
        generar respuestas, Meta para WhatsApp/Instagram, [PROVEEDOR SMTP] para el envío de
        mails, Stripe para pagos).
      </p>

      <h2>7. Modificaciones</h2>
      <p>
        Podemos actualizar estos términos; los cambios importantes se van a avisar por mail o
        dentro del panel con [X días] de anticipación.
      </p>

      <h2>8. Ley aplicable</h2>
      <p>Estos términos se rigen por las leyes de [JURISDICCIÓN A DEFINIR].</p>
    </LegalLayout>
  )
}
