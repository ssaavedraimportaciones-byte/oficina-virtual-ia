'use client'

import { useEffect } from 'react'
import { captureException } from '@/lib/sentry'

interface Props { error: Error & { digest?: string }; reset: () => void }

export default function ApprovalsError({ error, reset }: Props) {
  useEffect(() => { captureException(error, { action: 'ApprovalsError' }) }, [error])
  return (
    <div className="p-8 max-w-xl mx-auto mt-12">
      <div className="bg-red-950 border border-red-800 rounded-xl p-6 text-center space-y-3">
        <p className="text-3xl">✅</p>
        <p className="text-red-300 font-medium">Error al cargar aprobaciones</p>
        <p className="text-red-400 text-sm">No se pudo obtener la cola de aprobaciones.</p>
        <div className="flex gap-3 justify-center pt-2">
          <button onClick={reset} className="px-4 py-2 text-sm bg-red-800 hover:bg-red-700 text-red-200 rounded-lg transition-colors">
            Reintentar
          </button>
          <a href="/dashboard" className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
            Ir al dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
