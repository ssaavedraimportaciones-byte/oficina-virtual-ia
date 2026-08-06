const APP_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-success' : 'bg-gray-600'}`}
    />
  )
}

export default function ConexionesPage() {
  const claudeReady = Boolean(process.env.ANTHROPIC_API_KEY)
  const whatsappReady = Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
  )
  const instagramReady = Boolean(
    process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_PAGE_ID,
  )

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <h1 className="text-2xl font-bold text-white">Conexiones</h1>
      <p className="mt-2 text-sm text-gray-400">
        Estas credenciales se cargan como variables de entorno del servidor, nunca se guardan
        desde acá para no exponerlas.
      </p>

      <section className="mt-10 rounded-lg border border-gray-800 p-6">
        <div className="flex items-center gap-2">
          <StatusDot ok={claudeReady} />
          <h2 className="font-medium text-white">Claude (Anthropic)</h2>
        </div>
        <p className="mt-2 text-sm text-gray-400">
          {claudeReady
            ? 'Conectado. El agente ya puede generar respuestas.'
            : 'Falta ANTHROPIC_API_KEY en las variables de entorno.'}
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-gray-800 p-6">
        <div className="flex items-center gap-2">
          <StatusDot ok={whatsappReady} />
          <h2 className="font-medium text-white">WhatsApp Business</h2>
        </div>
        <p className="mt-2 text-sm text-gray-400">
          {whatsappReady
            ? 'Credenciales cargadas.'
            : 'Faltan WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID.'}
        </p>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-gray-400">
          <li>
            En Meta for Developers, creá una app y agregá el producto{' '}
            <span className="text-gray-200">WhatsApp</span>.
          </li>
          <li>
            Copiá el <span className="text-gray-200">Phone number ID</span> y el token de acceso
            a <code className="text-amber-400">WHATSAPP_PHONE_NUMBER_ID</code> /{' '}
            <code className="text-amber-400">WHATSAPP_ACCESS_TOKEN</code>.
          </li>
          <li>
            Configurá el webhook con URL{' '}
            <code className="break-all text-amber-400">{APP_URL}/api/webhooks/whatsapp</code> y
            el mismo valor de <code className="text-amber-400">WHATSAPP_VERIFY_TOKEN</code> como
            verify token.
          </li>
          <li>Suscribite al campo de webhook &ldquo;messages&rdquo;.</li>
        </ol>
      </section>

      <section className="mt-6 rounded-lg border border-gray-800 p-6">
        <div className="flex items-center gap-2">
          <StatusDot ok={instagramReady} />
          <h2 className="font-medium text-white">Instagram</h2>
        </div>
        <p className="mt-2 text-sm text-gray-400">
          {instagramReady
            ? 'Credenciales cargadas.'
            : 'Faltan INSTAGRAM_ACCESS_TOKEN y INSTAGRAM_PAGE_ID.'}
        </p>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-gray-400">
          <li>Vinculá tu cuenta de Instagram profesional a una página de Facebook.</li>
          <li>
            En la misma app de Meta, agregá el producto{' '}
            <span className="text-gray-200">Instagram</span> y generá el token de la página.
          </li>
          <li>
            Configurá el webhook con URL{' '}
            <code className="break-all text-amber-400">{APP_URL}/api/webhooks/instagram</code> y
            el valor de <code className="text-amber-400">INSTAGRAM_VERIFY_TOKEN</code>.
          </li>
        </ol>
      </section>
    </div>
  )
}
