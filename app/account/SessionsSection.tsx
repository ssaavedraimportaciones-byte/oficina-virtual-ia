'use client'

import { useEffect, useState } from 'react'

interface SessionRow {
  id: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  expiresAt: string
  isCurrent: boolean
}

function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Dispositivo desconocido'
  if (/iphone|ipad/i.test(userAgent)) return 'iPhone/iPad'
  if (/android/i.test(userAgent)) return 'Android'
  if (/macintosh/i.test(userAgent)) return 'Mac'
  if (/windows/i.test(userAgent)) return 'Windows'
  if (/linux/i.test(userAgent)) return 'Linux'
  return 'Navegador'
}

export default function SessionsSection() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/sessions')
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions ?? []))
  }, [])

  async function handleRevoke(id: string) {
    setRevoking(id)
    await fetch(`/api/auth/sessions/${id}`, { method: 'DELETE' })
    setSessions((prev) => prev?.filter((s) => s.id !== id) ?? null)
    setRevoking(null)
  }

  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <h2 className="text-sm font-medium text-white">Sesiones activas</h2>
      <p className="mt-1 text-xs text-gray-500">
        Dónde iniciaste sesión. Cerrar una acá no afecta a las demás.
      </p>

      {!sessions ? (
        <p className="mt-3 text-xs text-gray-600">Cargando…</p>
      ) : (
        <div className="mt-3 flex flex-col divide-y divide-gray-800">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-200">{describeDevice(s.userAgent)}</span>
                  {s.isCurrent && (
                    <span className="rounded-full border border-emerald-800 px-2 py-0.5 text-[10px] uppercase text-emerald-500">
                      Esta sesión
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-gray-600">
                  {s.ipAddress ?? 'IP desconocida'} · desde{' '}
                  {new Date(s.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
              {!s.isCurrent && (
                <button
                  onClick={() => handleRevoke(s.id)}
                  disabled={revoking === s.id}
                  className="shrink-0 text-xs text-gray-500 hover:text-danger disabled:opacity-50"
                >
                  {revoking === s.id ? 'Cerrando…' : 'Cerrar sesión'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
