import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Configuración' }

export default function SettingsPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold text-white">Configuración</h1>
      <p className="text-gray-400 mt-2">Ajustes del sistema — en construcción</p>
    </main>
  )
}
