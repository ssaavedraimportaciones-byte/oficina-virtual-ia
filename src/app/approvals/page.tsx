import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Aprobaciones' }

export default function ApprovalsPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold text-white">Aprobaciones Pendientes</h1>
      <p className="text-gray-400 mt-2">Cola de aprobaciones — en construcción</p>
    </main>
  )
}
