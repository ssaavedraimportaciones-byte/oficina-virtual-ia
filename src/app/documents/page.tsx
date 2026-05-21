import Link from 'next/link'
import AppShell from '@/components/layout/shell'
import DocumentList from '@/components/documents/DocumentList'

export const metadata = { title: 'Documentos' }

export default function DocumentsPage() {
  return (
    <AppShell>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Documentos</h1>
          <Link
            href="/documents/new"
            className="bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            + Nuevo documento
          </Link>
        </div>
        <DocumentList />
      </div>
    </AppShell>
  )
}
