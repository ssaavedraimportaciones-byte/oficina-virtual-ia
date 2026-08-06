import Link from 'next/link'
import { getAccess } from '@/lib/adminAuth'
import { getAdminOverview } from '@/lib/store'
import { getIndustryTemplate } from '@/lib/industries'
import { providerStatus } from '@/lib/llm'
import LoginForm from './LoginForm'
import DeleteBusinessButton from './DeleteBusinessButton'

export const dynamic = 'force-dynamic'

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-800 p-5">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  )
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-success' : 'bg-gray-700'}`} />
  )
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export default async function AdminPage() {
  const access = await getAccess('admin')

  if (!access.configured) {
    return (
      <div className="flex min-h-screen items-center justify-center px-8">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-white">Panel bloqueado</h1>
          <p className="mt-3 text-sm text-gray-400">
            Falta definir <code className="text-amber-400">ADMIN_PASSWORD</code> en las variables
            de entorno. Sin eso el panel queda bloqueado a propósito, para no exponer todos los
            negocios por una variable olvidada.
          </p>
        </div>
      </div>
    )
  }

  if (!access.authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center px-8">
        <LoginForm />
      </div>
    )
  }

  const overview = await getAdminOverview()

  const totals = overview.reduce(
    (acc, item) => ({
      conversations: acc.conversations + item.conversationCount,
      messages: acc.messages + item.messageCount,
      connected:
        acc.connected +
        (item.business.credentials.whatsappPhoneNumberId ||
        item.business.credentials.instagramPageId
          ? 1
          : 0),
    }),
    { conversations: 0, messages: 0, connected: 0 },
  )

  const llm = providerStatus()
  const whatsappVerify = Boolean(process.env.WHATSAPP_VERIFY_TOKEN)
  const instagramVerify = Boolean(process.env.INSTAGRAM_VERIFY_TOKEN)

  return (
    <div className="mx-auto max-w-5xl px-8 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Administración</h1>
          <p className="mt-1 text-sm text-gray-400">Todos los negocios de la plataforma.</p>
        </div>
        <Link
          href="/panel"
          className="text-sm text-gray-400 hover:text-amber-400"
        >
          Ir al panel →
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <Stat label="Negocios" value={overview.length} />
        <Stat label="Con canal conectado" value={totals.connected} />
        <Stat label="Conversaciones" value={totals.conversations} />
        <Stat label="Mensajes" value={totals.messages} />
      </div>

      <section className="mt-8 rounded-lg border border-gray-800 p-6">
        <h2 className="font-medium text-white">Estado del sistema</h2>
        <div className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Dot ok={llm.configured} />
            <span className="text-gray-300">Motor de IA</span>
            <span className="text-gray-600">
              {llm.configured
                ? `${llm.id === 'openai' ? 'OpenAI' : 'Anthropic'} · modelo ${llm.model}`
                : 'sin configurar — cargá ANTHROPIC_API_KEY u OPENAI_API_KEY'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Dot ok={whatsappVerify} />
            <span className="text-gray-300">WHATSAPP_VERIFY_TOKEN</span>
          </div>
          <div className="flex items-center gap-2">
            <Dot ok={instagramVerify} />
            <span className="text-gray-300">INSTAGRAM_VERIFY_TOKEN</span>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-medium text-white">Negocios</h2>
        {overview.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no hay negocios creados.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Negocio</th>
                  <th className="px-4 py-3 font-medium">Canales</th>
                  <th className="px-4 py-3 font-medium">Convs.</th>
                  <th className="px-4 py-3 font-medium">Msjs.</th>
                  <th className="px-4 py-3 font-medium">Datos</th>
                  <th className="px-4 py-3 font-medium">Alertas</th>
                  <th className="px-4 py-3 font-medium">Última actividad</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {overview.map((item) => {
                  const template = getIndustryTemplate(item.business.templateId)
                  const { credentials } = item.business
                  return (
                    <tr key={item.business.id} className="hover:bg-gray-900/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/panel/${item.business.id}`}
                          className="font-medium text-white hover:text-amber-400"
                        >
                          {template?.emoji} {item.business.config.businessName}
                        </Link>
                        <div className="text-xs text-gray-500">{item.business.config.industry}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 text-xs text-gray-400">
                          <span className="flex items-center gap-1.5">
                            <Dot ok={Boolean(credentials.whatsappPhoneNumberId)} /> WhatsApp
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Dot ok={Boolean(credentials.instagramPageId)} /> Instagram
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{item.conversationCount}</td>
                      <td className="px-4 py-3 text-gray-300">{item.messageCount}</td>
                      <td className="px-4 py-3">
                        <span
                          className={item.knowledgeCount === 0 ? 'text-danger' : 'text-gray-300'}
                        >
                          {item.knowledgeCount}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 text-xs">
                          {item.soldOutProducts > 0 && (
                            <span className="text-danger">
                              {item.soldOutProducts} agotado{item.soldOutProducts === 1 ? '' : 's'}
                            </span>
                          )}
                          {item.pendingOrders > 0 && (
                            <span className="text-amber-400">
                              {item.pendingOrders} pedido{item.pendingOrders === 1 ? '' : 's'}
                            </span>
                          )}
                          {item.soldOutProducts === 0 && item.pendingOrders === 0 && (
                            <span className="text-gray-600">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatDate(item.lastActivityAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DeleteBusinessButton
                          businessId={item.business.id}
                          businessName={item.business.config.businessName}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-600">
          &ldquo;Datos&rdquo; es la cantidad de entradas en la base de conocimiento: en rojo si
          está en cero, porque ahí el agente responde sin datos del negocio.
        </p>
      </section>
    </div>
  )
}
