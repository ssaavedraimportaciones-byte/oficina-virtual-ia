import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getMaintenance, listActiveAnnouncements, type AnnouncementLevel } from '@/lib/platform'

export const dynamic = 'force-dynamic'

const BANNER_STYLE: Record<AnnouncementLevel, string> = {
  info: 'border-sky-900/60 bg-sky-950/40 text-sky-200',
  warning: 'border-amber-900/60 bg-amber-950/40 text-amber-200',
  maintenance: 'border-red-900/60 bg-red-950/40 text-red-200',
}

export default async function PanelRootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // Avisos del dueño de la plataforma (mantenimiento, reparaciones, novedades).
  const [announcements, maintenance] = await Promise.all([listActiveAnnouncements(), getMaintenance()])

  return (
    <>
      {maintenance.enabled && (
        <div className={`border-b px-6 py-2 text-center text-sm ${BANNER_STYLE.maintenance}`}>
          <strong>Mantenimiento en curso:</strong> los agentes están pausados y tus clientes reciben un
          aviso. Vuelven solos apenas termine.
        </div>
      )}
      {announcements.map((announcement) => (
        <div key={announcement.id} className={`border-b px-6 py-2 text-center text-sm ${BANNER_STYLE[announcement.level]}`}>
          {announcement.message}
        </div>
      ))}
      {children}
    </>
  )
}
