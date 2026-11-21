import { getBusinessAnalytics } from '@/lib/store'
import { formatPrice } from '@/lib/catalog'
import { getAgentUsage } from '@/lib/usage'
import { PLAN_LABEL } from '@/lib/plans'
import SetupNext from '../SetupNext'
import Link from 'next/link'
import { getSalesSettings } from '@/lib/payments'
import { getInventoryReport, listIngredients } from '@/lib/inventory'
import { startOfBusinessMonth } from '@/lib/timezone'

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
  const [stats, usage, sales] = await Promise.all([
    getBusinessAnalytics(businessId),
    getAgentUsage(businessId),
    getSalesSettings(businessId),
  ])
  const [inv, ingredients] = sales.ingredientsEnabled
    ? await Promise.all([getInventoryReport(businessId, startOfBusinessMonth()), listIngredients(businessId)])
    : [null, []]
  const toRestock = ingredients.filter((i) => i.stock <= 0 || (i.minStock > 0 && i.stock <= i.minStock)).length

  return (
    <div className="px-4 py-8 sm:px-8 sm:py-10">
      <SetupNext businessId={businessId} />
      <h1 className="text-2xl font-bold text-white">Resumen</h1>
      <p className="mt-1 text-sm text-gray-400">Cómo viene el negocio, de un vistazo.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Conversaciones" value={stats.conversationCount} />
        <Stat label="Abiertas ahora" value={stats.openConversations} accent={stats.openConversations > 0} />
        <Stat label="Mensajes totales" value={stats.messageCount} />
        <Stat label="Base de conocimiento" value={stats.knowledgeCount} />
      </div>

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-gray-500">Plan</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={`Respuestas del agente este mes (plan ${PLAN_LABEL[usage.plan]})`}
          value={usage.limit === null ? usage.used : `${usage.used} / ${usage.limit}`}
          accent={usage.limit !== null && usage.used >= usage.limit * 0.8}
        />
      </div>

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-gray-500">Agenda</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Horas agendadas" value={stats.appointmentCount} />
        <Stat label="Horas confirmadas" value={stats.confirmedAppointments} />
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

      {inv && (
        <>
          <h2 className="mt-10 flex items-baseline justify-between text-sm font-medium uppercase tracking-wide text-gray-500">
            Inventario y costos · este mes
            <Link href={`/panel/${businessId}/inventario`} className="text-xs normal-case tracking-normal text-amber-300 hover:text-amber-200">
              Ver detalle →
            </Link>
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Costo de la materia prima vendida" value={formatPrice(inv.costOfSales)} />
            <Stat label="Ganancia bruta (con receta)" value={formatPrice(inv.revenueWithRecipe - inv.costOfSales)} />
            <Stat label="Compras de mercadería" value={formatPrice(inv.purchases)} />
            <Stat label="Ingredientes por reponer" value={toRestock} accent={toRestock > 0} />
          </div>
        </>
      )}
    </div>
  )
}
