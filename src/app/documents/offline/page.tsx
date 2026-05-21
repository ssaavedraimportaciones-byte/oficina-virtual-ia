import type { Metadata } from 'next'
import { headers } from 'next/headers'
import AppShell from '@/components/layout/shell'
import OfflineWorkspace from '@/components/offline/OfflineWorkspace'

export const metadata: Metadata = { title: 'Documentos offline — SafeCheck AI' }

export default async function OfflineDocumentsPage() {
  const h = await headers()
  const userId    = h.get('x-user-id')    ?? ''
  const companyId = h.get('x-user-company') ?? ''

  return (
    <AppShell>
      <OfflineWorkspace userId={userId} companyId={companyId} />
    </AppShell>
  )
}
