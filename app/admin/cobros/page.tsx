import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser, isPlatformAdmin } from '@/lib/auth'
import { getBillingOverview } from '@/lib/platform'
import LogoutButton from '../../LogoutButton'
import AdminNav from '../AdminNav'
import PlanButton from './PlanButton'

export const dynamic = 'force-dynamic'

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-800 p-5">
      <div className={`text-2xl font-bold ${accent ? 'text-amber-400' : 'text-white'}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  )
}

export default async function CobrosPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!isPlatformAdmin(user)) redirect('/panel')

  const { users, totals } = await getBillingOverview()

  return (
    <div className="mx-auto max-w-5xl px-8 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cobros</h1>
          <p className="mt-1 text-sm text-gray-400">Quién paga, quién usa y cuánto consume cada cliente.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/panel" className="text-sm text-gray-400 hover:text-amber-400">
            Ir al panel →
          </Link>
          <LogoutButton className="text-sm text-gray-500 hover:text-gray-300" />
        </div>
      </div>

      <AdminNav active="/admin/cobros" />

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <Stat label="Clientes pagando" value={totals.paying} accent={totals.paying > 0} />
        <Stat label="PRO de cortesía" value={totals.courtesy} />
        <Stat label="Plan gratis" value={totals.free} />
        <Stat label="Respuestas este mes" value={totals.repliesThisMonth} />
      </div>
      {(totals.businessesNearLimit > 0 || totals.businessesOverLimit > 0) && (
        <p className="mt-4 text-sm text-amber-400">
          {totals.businessesOverLimit > 0 && `${totals.businessesOverLimit} empresa(s) agotaron su cupo del mes. `}
          {totals.businessesNearLimit > 0 && `${totals.businessesNearLimit} está(n) cerca del límite (80 % o más).`}
        </p>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-medium text-white">Clientes</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Pago</th>
                <th className="px-4 py-3 font-medium">Consumo del mes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map((row) => (
                <tr key={row.id} className="align-top hover:bg-gray-900/50">
                  <td className="px-4 py-3">
                    <div className="text-white">{row.email}</div>
                    <div className="text-xs text-gray-500">
                      {row.role === 'PLATFORM_ADMIN' ? 'Administrador de plataforma' : `${row.businesses.length} negocio(s)`}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${
                        row.plan === 'PRO' ? 'border-amber-700 text-amber-400' : 'border-gray-700 text-gray-500'
                      }`}
                    >
                      {row.plan === 'PRO' ? 'PRO' : 'Gratis'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {row.stripeSubscriptionId ? (
                      <a
                        href={`https://dashboard.stripe.com/customers/${row.stripeCustomerId ?? ''}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:underline"
                      >
                        Suscripción en Stripe ↗
                      </a>
                    ) : row.courtesy ? (
                      <span className="text-amber-400">Cortesía (no paga)</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {row.businesses.length === 0 ? (
                      <span className="text-gray-600">—</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {row.businesses.map((b) => (
                          <span key={b.businessId} className={b.usage.exceeded ? 'text-danger' : 'text-gray-300'}>
                            {b.name}: {b.usage.used}
                            {b.usage.limit === null ? '' : ` / ${b.usage.limit}`}
                            {b.replyLimitOverride !== null && <span className="text-amber-400"> (límite manual)</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {/* El plan de un administrador de plataforma no se toca desde acá. */}
                    {row.role !== 'PLATFORM_ADMIN' && !row.stripeSubscriptionId && (
                      <PlanButton userId={row.id} email={row.email} plan={row.plan} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-600">
          El consumo cuenta las respuestas del agente de este mes (también las del simulador). El plan de quien paga por
          Stripe lo maneja Stripe: no se cambia desde acá. Para fijar un límite distinto a una empresa, ve a{' '}
          <Link href="/admin/sistema" className="text-amber-400 hover:underline">
            Sistema
          </Link>
          .
        </p>
      </section>
    </div>
  )
}
