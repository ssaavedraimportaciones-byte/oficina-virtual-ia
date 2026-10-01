import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser, isPlatformAdmin } from '@/lib/auth'
import { getMaintenance, listAnnouncements, listBusinessAdminRows } from '@/lib/platform'
import LogoutButton from '../../LogoutButton'
import AdminNav from '../AdminNav'
import AnnouncementsCard from './AnnouncementsCard'
import BusinessLimitsTable from './BusinessLimitsTable'
import MaintenanceCard from './MaintenanceCard'

export const dynamic = 'force-dynamic'

export default async function SistemaPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!isPlatformAdmin(user)) redirect('/panel')

  const [maintenance, announcements, rows] = await Promise.all([
    getMaintenance(),
    listAnnouncements(),
    listBusinessAdminRows(),
  ])

  return (
    <div className="mx-auto max-w-5xl px-8 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sistema</h1>
          <p className="mt-1 text-sm text-gray-400">Mantenimiento, avisos a tus clientes, límites y notas por empresa.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/panel" className="text-sm text-gray-400 hover:text-amber-400">
            Ir al panel →
          </Link>
          <LogoutButton className="text-sm text-gray-500 hover:text-gray-300" />
        </div>
      </div>

      <AdminNav active="/admin/sistema" />

      <div className="mt-8 flex flex-col gap-6">
        <MaintenanceCard initialEnabled={maintenance.enabled} initialMessage={maintenance.message} />
        <AnnouncementsCard initial={announcements} />

        <section>
          <h2 className="mb-1 font-medium text-white">Límites y notas por empresa</h2>
          <p className="mb-3 text-sm text-gray-400">
            El límite manual reemplaza al del plan solo para esa empresa (vacío = vale el del plan). Las notas son solo
            para ti: el cliente nunca las ve.
          </p>
          <BusinessLimitsTable rows={rows} />
        </section>
      </div>
    </div>
  )
}
