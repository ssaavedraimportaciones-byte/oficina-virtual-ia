import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Documentos' }

export default function DocumentsPage() {
  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Documentos</h1>
        <a
          href="/documents/new"
          className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition"
        >
          + Nuevo
        </a>
      </div>
      <p className="text-gray-400">Lista de documentos — en construcción</p>
    </main>
  )
}
