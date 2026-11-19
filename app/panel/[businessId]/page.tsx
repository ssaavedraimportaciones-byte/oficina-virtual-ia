import Link from 'next/link'
import { getBusiness, listConversations } from '@/lib/store'
import NewConversationButton from './NewConversationButton'
import ConversationList from './ConversationList'

export const dynamic = 'force-dynamic'

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
          Todavía no hay conversaciones. Inicia una de prueba con el botón de arriba, o espera a
          que lleguen mensajes reales una vez conectado WhatsApp/Instagram en{' '}
          <Link href={`/panel/${businessId}/conexiones`} className="text-amber-400">
            Conexiones
          </Link>
          .
        </p>
      ) : (
        <ConversationList
          businessId={businessId}
          rows={conversations.map((c) => ({
            id: c.id,
            contactName: c.contactName,
            channel: c.channel,
            status: c.status,
            agentPaused: c.agentPaused,
            lastText: c.messages[c.messages.length - 1]?.text ?? null,
          }))}
        />
      )}
    </div>
  )
}
