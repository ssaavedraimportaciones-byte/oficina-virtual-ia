import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Documento' }

export default function DocumentDetailPage({ params }: { params: { id: string } }) {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold text-white">Documento #{params.id}</h1>
      <p className="text-gray-400 mt-2">Detalle — en construcción</p>
    </main>
  )
}
