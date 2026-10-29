import { BRAND } from '@/lib/brand'
import { COMPANY, COMPANY_ADDRESS } from '@/lib/legal'
import LegalLayout from '../LegalLayout'

export const metadata = { title: `Política de privacidad — ${BRAND.name}` }

export default function PrivacidadPage() {
  return (
    <LegalLayout title="Política de privacidad" updated={COMPANY.updated}>
      <h2>1. Quién trata tus datos</h2>
      <p>
        {BRAND.name} es un servicio de <strong>{COMPANY.legalName}</strong>, RUT {COMPANY.rut}, con
        domicilio en {COMPANY_ADDRESS}. Consultas sobre esta política:{' '}
        <a href={`mailto:${COMPANY.email}`} className="text-amber-400 hover:underline">
          {COMPANY.email}
        </a>
        .
      </p>

      <h2>2. Dos roles distintos</h2>
      <p>
        Esta política cubre dos situaciones que conviene no mezclar, porque las responsabilidades
        son distintas:
      </p>
      <ul>
        <li>
          <strong>Datos de quien contrata {BRAND.name}</strong> (el negocio y su equipo). Acá
          decidimos nosotros para qué se usan: somos responsables del tratamiento.
        </li>
        <li>
          <strong>Datos de los clientes finales</strong> que le escriben a ese negocio por WhatsApp
          o Instagram. Acá el negocio decide qué se trata y para qué; nosotros solo lo procesamos
          por su cuenta y siguiendo sus instrucciones. El negocio es el responsable y nosotros el
          encargado del tratamiento.
        </li>
      </ul>

      <h2>3. Qué datos se recolectan</h2>
      <ul>
        <li>
          <strong>De quien crea una cuenta:</strong> email y contraseña (guardada con hash, nunca
          en texto plano).
        </li>
        <li>
          <strong>Del negocio configurado:</strong> nombre, rubro, descripción, horarios, catálogo,
          y los tokens de acceso a WhatsApp/Instagram (guardados cifrados).
        </li>
        <li>
          <strong>De los clientes finales del negocio:</strong> nombre de contacto, número o
          usuario del canal, y el contenido de los mensajes que intercambian con el agente —
          necesario para que el agente pueda responder y para llevar el historial de la
          conversación.
        </li>
        <li>
          <strong>Técnicos:</strong> dirección IP y user-agent del navegador al iniciar sesión,
          para mostrar las sesiones activas y para limitar los intentos de login.
        </li>
      </ul>

      <h2>4. Para qué se usan</h2>
      <ul>
        <li>
          Operar el servicio: autenticar cuentas, generar las respuestas del agente, agendar horas,
          procesar pedidos.
        </li>
        <li>
          Enviar mails operativos: verificación de cuenta, recuperación de contraseña, aviso de
          conversación nueva.
        </li>
        <li>Facturar el plan pago, a través de Stripe.</li>
        <li>Seguridad: detectar intentos de fuerza bruta y prevenir abuso.</li>
      </ul>
      <p>
        No vendemos datos personales a terceros, no los usamos para publicidad y no entrenamos
        modelos de inteligencia artificial propios con las conversaciones.
      </p>

      <h2>5. Con quién se comparten</h2>
      <p>Para poder funcionar, algunos datos pasan por estos proveedores:</p>
      <ul>
        <li>
          <strong>El proveedor de inteligencia artificial configurado</strong> (Anthropic, OpenAI o
          un servicio compatible): recibe el contenido de la conversación para generar la respuesta
          del agente. Si un cliente manda una nota de voz, el audio también se envía a ese
          proveedor para transcribirlo a texto; el audio no se guarda, solo su transcripción.
        </li>
        <li>
          <strong>Meta Platforms</strong> (WhatsApp Business Platform e Instagram Messaging): es el
          canal por el que entran y salen los mensajes.
        </li>
        <li>
          <strong>Vercel</strong>: aloja y ejecuta la aplicación.
        </li>
        <li>
          <strong>Supabase</strong>: aloja la base de datos.
        </li>
        <li>
          <strong>El proveedor de correo SMTP configurado</strong>: envía los mails operativos de
          la cuenta.
        </li>
        <li>
          <strong>Stripe</strong>: procesa los pagos del plan pago. No guardamos números de tarjeta
          en nuestros servidores.
        </li>
      </ul>
      <p>
        Todos estos proveedores operan servidores fuera de Chile, así que usar {BRAND.name} implica
        una transferencia internacional de datos. Se contratan como encargados del tratamiento y
        solo pueden usar los datos para prestar su servicio.
      </p>

      <h2>6. Consentimiento de los clientes finales</h2>
      <p>
        WhatsApp solo permite escribirle a una persona que aceptó recibir mensajes de ese negocio.
        Conseguir y poder acreditar ese consentimiento es responsabilidad del negocio que contrata{' '}
        {BRAND.name}, no de {BRAND.name}. El agente se identifica como un asistente automatizado y
        toda conversación puede derivarse a una persona del negocio cuando el cliente lo pide.
      </p>

      <h2>7. Cuánto tiempo se guardan</h2>
      <p>
        Mientras la cuenta esté activa. Al eliminar un negocio o una cuenta se borran sus
        conversaciones, mensajes, horas agendadas y pedidos. Las copias de seguridad de la base de
        datos pueden conservar esa información hasta 30 días más, hasta que el respaldo rota.
      </p>

      <h2>8. Derechos de las personas</h2>
      <p>
        Cualquier persona, sea titular de una cuenta o cliente final atendido por un agente, puede
        pedir acceder a sus datos, rectificarlos, suprimirlos, oponerse a su tratamiento o pedir su
        portabilidad, escribiendo a{' '}
        <a href={`mailto:${COMPANY.email}`} className="text-amber-400 hover:underline">
          {COMPANY.email}
        </a>
        . Respondemos dentro de los plazos de la Ley N° 19.628 sobre protección de la vida privada
        y, desde su entrada en vigencia, de la Ley N° 21.719. Si el pedido es sobre datos que
        tratamos por cuenta de un negocio, lo derivamos a ese negocio, que es quien decide sobre
        ellos. Un dueño de negocio puede borrar una conversación o un contacto desde el panel.
      </p>

      <h2>9. Seguridad</h2>
      <p>
        Las contraseñas se guardan con scrypt, los tokens de los canales se cifran en la base con
        AES-256-GCM, las sesiones usan cookies httpOnly y los webhooks de Meta se verifican por
        firma antes de procesarse. Ningún sistema es infalible: ante un incidente de seguridad
        relevante se notificará a los afectados y a la autoridad según lo exija la normativa
        aplicable.
      </p>

      <h2>10. Menores de edad</h2>
      <p>
        {BRAND.name} no está dirigido a menores de 18 años ni se usa para crear cuentas a su
        nombre. Si un negocio atiende a menores por sus canales, es ese negocio quien debe reunir
        las autorizaciones que la ley exige para tratar sus datos.
      </p>

      <h2>11. Cambios</h2>
      <p>
        Si esta política cambia de forma relevante, se avisa por mail o dentro del panel con 15
        días de anticipación, y se actualiza la fecha del encabezado.
      </p>
    </LegalLayout>
  )
}
