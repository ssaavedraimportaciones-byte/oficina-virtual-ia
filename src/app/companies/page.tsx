import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Empresas' }

export default function CompaniesPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold text-white">Empresas y Faenas</h1>
      <p className="text-gray-400 mt-2">Gestión de empresas — en construcción</p>
    </main>
  )
}
