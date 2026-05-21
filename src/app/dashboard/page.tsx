import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

export default function DashboardPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold text-amber-400">Dashboard</h1>
      <p className="text-gray-400 mt-2">Resumen de actividad — en construcción</p>
    </main>
  )
}
