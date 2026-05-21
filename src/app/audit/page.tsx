import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/shell'
import AuditView from '@/components/audit/AuditView'
import { canAccess } from '@/lib/permissions'
import type { UserRole } from '@/types/user'

export const metadata: Metadata = { title: 'Auditoría Forense — SafeCheck AI' }

export default async function AuditPage() {
  const h = await headers()
  const userRole = (h.get('x-user-role') ?? 'WORKER') as UserRole

  if (!canAccess(userRole, 'audit:view')) {
    redirect('/unauthorized')
  }

  const isAdmin = userRole === 'SYSTEM_ADMIN'

  return (
    <AppShell>
      <div className="p-6 max-w-screen-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Auditoría Forense</h1>
          <p className="text-gray-400 text-sm mt-1">
            {isAdmin
              ? 'Vista completa — todas las empresas y metadatos de dispositivo'
              : 'Vista restringida — solo documentos de tu empresa'}
          </p>
        </div>
        <AuditView isAdmin={isAdmin} />
      </div>
    </AppShell>
  )
}
