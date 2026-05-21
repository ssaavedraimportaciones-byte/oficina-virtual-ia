import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/shell'
import DashboardView from '@/components/dashboard/DashboardView'
import { canAccess } from '@/lib/permissions'
import type { UserRole } from '@/types/user'

export const metadata: Metadata = { title: 'Dashboard — SafeCheck AI' }

export default async function DashboardPage() {
  const h = await headers()
  const userRole = (h.get('x-user-role') ?? 'WORKER') as UserRole

  if (!canAccess(userRole, 'dashboard:view')) {
    redirect('/documents')
  }

  const canViewAll = canAccess(userRole, 'documents:view_all')

  return (
    <AppShell>
      <DashboardView userRole={userRole} canViewAll={canViewAll} />
    </AppShell>
  )
}
