import { getBusinessAnalytics } from '@/lib/store'
import { formatPrice } from '@/lib/catalog'

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-800 p-5">
      <div className={`text-2xl font-bold ${accent ? 'text-amber-400' : 'text-white'}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  )
}

export default async function ResumenPage({
  params,
}: {
  params: Promise<{ businessId: string }>
}) {
  const { businessId } = await params
  const stats = await getBusinessAnalytics(businessId)

  return (
    <div className="px-8 py-10">
      <h1 className="text-2xl font-bold text-white">Resumen</h1>
      <p className="mt-1 text-sm text-gray-400">Cómo viene el negocio, de un vistazo.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Conversaciones" value={stats.conversationCount} />
        <Stat label="Abiertas ahora" value={stats.openConversations} accent={stats.openConversations > 0} />
        <Stat label="Mensajes totales" value={stats.messageCount} />
        <Stat label="Base de conocimiento" value={stats.knowledgeCount} />
      </div>

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-gray-500">Agenda</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Turnos totales" value={stats.appointmentCount} />
        <Stat label="Turnos confirmados" value={stats.confirmedAppointments} />
      </div>

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-gray-500">Pedidos</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pedidos totales" value={stats.orderCount} />
        <Stat label="Pendientes" value={stats.pendingOrders} accent={stats.pendingOrders > 0} />
        <Stat label="Facturado" value={formatPrice(stats.revenueTotal)} />
        <Stat
          label="Productos agotados"
          value={stats.soldOutProducts}
          accent={stats.soldOutProducts > 0}
        />
      </div>
    </div>
  )
}
