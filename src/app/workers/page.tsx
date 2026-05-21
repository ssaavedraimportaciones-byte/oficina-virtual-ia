import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Trabajadores' }

export default function WorkersPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold text-white">Trabajadores</h1>
      <p className="text-gray-400 mt-2">Gestión de trabajadores — en construcción</p>
    </main>
  )
}
