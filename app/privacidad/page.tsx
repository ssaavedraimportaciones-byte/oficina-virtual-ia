import LegalLayout from '../LegalLayout'

export const metadata = { title: 'Política de privacidad — AgentsApp' }

export default function PrivacidadPage() {
  return (
    <LegalLayout title="Política de privacidad" updated="[completar fecha de publicación]">
      <h2>1. Qué datos recolectamos</h2>
      <ul>
        <li>
          <strong>De quien crea una cuenta:</strong> email y contraseña (guardada con hash, nunca
          en texto plano).
        </li>
        <li>
          <strong>Del negocio configurado:</strong> nombre, rubro, descripción, horarios,
          catálogo, y los tokens de acceso a WhatsApp/Instagram (guardados cifrados).
        </li>
        <li>
          <strong>De los clientes finales del negocio:</strong> nombre de contacto, número/usuario
          del canal (WhatsApp o Instagram), y el contenido de los mensajes que intercambian con el
          agente — necesario para que el agente pueda responder y para llevar el historial de la
          conversación.
        </li>
        <li>
          <strong>Técnicos:</strong> dirección IP y user-agent del navegador al iniciar sesión
          (para mostrar "sesiones activas" y para el límite de intentos de login).
        </li>
      </ul>

      <h2>2. Para qué se usan</h2>
      <ul>
        <li>Operar el servicio: autenticar cuentas, generar respuestas del agente, agendar turnos, procesar pedidos.</li>
        <li>Enviar mails operativos: verificación de cuenta, recuperación de contraseña, aviso de conversación nueva.</li>
        <li>Facturación del plan pago, a través de Stripe.</li>
        <li>Seguridad: detectar intentos de fuerza bruta, prevenir abuso.</li>
      </ul>
      <p>No vendemos datos personales a terceros.</p>

      <h2>3. Con quién se comparte</h2>
      <p>Para poder funcionar, algunos datos pasan por estos proveedores externos:</p>
      <ul>
        <li>
          <strong>Anthropic y/o OpenAI</strong> (el que esté configurado): reciben el contenido de
          la conversación para generar la respuesta del agente. Ver sus propias políticas de
          privacidad y retención de datos.
        </li>
        <li>
          <strong>Meta (WhatsApp Business API / Instagram Messaging):</strong> es el canal por el
          que entran y salen los mensajes.
        </li>
        <li>
          <strong>[PROVEEDOR SMTP, p. ej. SendGrid/Resend/Gmail]:</strong> envía los mails
          operativos de la cuenta.
        </li>
        <li>
          <strong>Stripe:</strong> procesa los pagos del plan PRO; no almacenamos números de
          tarjeta en nuestros servidores.
        </li>
        <li>
          <strong>[PROVEEDOR DE HOSTING/BASE DE DATOS]:</strong> aloja la infraestructura donde
          vive la base de datos.
        </li>
      </ul>

      <h2>4. Cuánto tiempo se guardan los datos</h2>
      <p>
        Mientras la cuenta esté activa. Al eliminar un negocio o una cuenta, se borran sus
        conversaciones, mensajes, turnos y pedidos asociados. [DEFINIR si hay un período de
        retención de backups y cuánto dura.]
      </p>

      <h2>5. Derechos de las personas titulares de los datos</h2>
      <p>
        Cualquier persona (dueño de cuenta o cliente final atendido por un agente) puede pedir
        acceder, corregir o eliminar sus datos escribiendo a [EMAIL DE CONTACTO]. Un dueño de
        negocio puede eliminar una conversación o un contacto directamente desde el panel.
      </p>

      <h2>6. Seguridad</h2>
      <p>
        Las contraseñas se guardan con scrypt (nunca en texto plano), los tokens de canales se
        cifran en la base con AES-256-GCM, las sesiones usan cookies httpOnly, y los webhooks de
        Meta se verifican por firma antes de procesarse. Ningún sistema es 100% infalible; ante
        cualquier incidente de seguridad relevante, se va a notificar según lo exija la normativa
        aplicable.
      </p>

      <h2>7. Menores de edad</h2>
      <p>El servicio no está dirigido a menores de [EDAD A DEFINIR según jurisdicción].</p>

      <h2>8. Contacto</h2>
      <p>Consultas sobre esta política: [EMAIL DE CONTACTO].</p>
    </LegalLayout>
  )
}
