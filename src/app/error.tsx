'use client'

import { useEffect } from 'react'
import { captureException } from '@/lib/sentry'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    captureException(error, { action: 'GlobalErrorBoundary' })
  }, [error])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-gray-900 border border-red-800 rounded-xl p-8 max-w-md w-full text-center space-y-4">
        <p className="text-4xl">⚠️</p>
        <h1 className="text-xl font-bold text-white">Algo salió mal</h1>
        <p className="text-gray-400 text-sm">
          El sistema encontró un error inesperado. Si el problema persiste, contacte al administrador.
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={reset}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold rounded-lg text-sm transition-colors"
          >
            Reintentar
          </button>
          <a
            href="/dashboard"
            className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors block"
          >
            Ir al dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
