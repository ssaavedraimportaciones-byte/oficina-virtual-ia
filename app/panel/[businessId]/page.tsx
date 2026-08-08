import Link from 'next/link'
import { getBusiness, listConversations } from '@/lib/store'
import NewConversationButton from './NewConversationButton'

export const dynamic = 'force-dynamic'

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  simulador: 'Simulador',
}

const STATUS_STYLE: Record<string, string> = {
  abierta: 'text-amber-400 border-amber-500/40',
  calificada: 'text-success border-success/40',
  cerrada: 'text-gray-500 border-gray-700',
}

export default async function ConversacionesPage({
  params,
}: {
  params: Promise<{ businessId: string }>
}) {
  const { businessId } = await params
  const business = await getBusiness(businessId)
  const conversations = await listConversations(businessId)

  return (
    <div className="px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Conversaciones</h1>
          <p className="text-sm text-gray-400">
            Agente: <span className="text-amber-400">{business?.config.agentName}</span>
          </p>
        </div>
        <NewConversationButton businessId={businessId} />
      </div>

      {conversations.length === 0 ? (
        <p className="text-sm text-gray-500">
          Todavía no hay conversaciones. Iniciá una de prueba con el botón de arriba, o esperá a
          que lleguen mensajes reales una vez conectado WhatsApp/Instagram en{' '}
          <Link href={`/panel/${businessId}/conexiones`} className="text-amber-400">
            Conexiones
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-800 rounded-lg border border-gray-800">
          {conversations.map((conversation) => {
            const last = conversation.messages[conversation.messages.length - 1]
            return (
              <Link
                key={conversation.id}
                href={`/panel/${businessId}/conversaciones/${conversation.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-900/60"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{conversation.contactName}</span>
                    <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-400">
                      {CHANNEL_LABEL[conversation.channel]}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-gray-500">
                    {last ? last.text : 'Sin mensajes todavía'}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs ${STATUS_STYLE[conversation.status]}`}
                >
                  {conversation.status}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
