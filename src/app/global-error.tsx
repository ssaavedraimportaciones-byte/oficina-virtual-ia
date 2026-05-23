'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

// Required by Sentry for React Server Component error tracking.
// This wraps the entire app (including layout) — must include <html> and <body>.
export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="es">
      <body style={{ margin: 0, background: '#030712', color: '#f8fafc', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
        <div style={{ background: '#111827', border: '1px solid #7f1d1d', borderRadius: '12px', padding: '32px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</p>
          <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Error crítico</h1>
          <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '24px' }}>
            Ocurrió un error inesperado. El equipo de soporte fue notificado automáticamente.
          </p>
          {error.digest && (
            <p style={{ fontSize: '11px', fontFamily: 'monospace', color: '#4b5563', marginBottom: '20px' }}>
              Ref: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{ background: '#d97706', color: '#000', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
