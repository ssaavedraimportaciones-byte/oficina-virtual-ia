import Link from 'next/link'
import AppShell from '@/components/layout/shell'
import DocumentFormBase from '@/components/documents/DocumentFormBase'

export const metadata = { title: 'Nuevo documento' }

export default function NewDocumentPage() {
  return (
    <AppShell>
      <div className="p-6 max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/documents" className="text-gray-400 hover:text-white text-sm transition-colors">
            ← Documentos
          </Link>
          <span className="text-gray-700">/</span>
          <h1 className="text-xl font-bold text-white">Nuevo documento</h1>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <DocumentFormBase />
        </div>
      </div>
    </AppShell>
  )
}
