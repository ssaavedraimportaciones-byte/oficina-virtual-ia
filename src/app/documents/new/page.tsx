import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Nuevo Documento' }

export default function NewDocumentPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold text-white">Nuevo Documento</h1>
      <p className="text-gray-400 mt-2">Formulario de creación — en construcción</p>
    </main>
  )
}
