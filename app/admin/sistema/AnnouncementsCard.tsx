'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AnnouncementItem, AnnouncementLevel } from '@/lib/platform'

const LEVELS: { value: AnnouncementLevel; label: string }[] = [
  { value: 'info', label: 'Novedad' },
  { value: 'warning', label: 'Advertencia' },
  { value: 'maintenance', label: 'Mantenimiento / reparación' },
]

export default function AnnouncementsCard({ initial }: { initial: AnnouncementItem[] }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [level, setLevel] = useState<AnnouncementLevel>('info')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, level }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? 'No se pudo publicar')
      return
    }
    setMessage('')
    router.refresh()
  }

  async function toggle(item: AnnouncementItem) {
    await fetch(`/api/admin/announcements/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    })
    router.refresh()
  }

  async function remove(item: AnnouncementItem) {
    if (!window.confirm('¿Borrar este aviso?')) return
    await fetch(`/api/admin/announcements/${item.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <section className="rounded-lg border border-gray-800 p-6">
      <h2 className="font-medium text-white">Avisos a tus clientes</h2>
      <p className="mt-1 text-sm text-gray-400">
        Aparecen como una franja arriba del panel de todas las empresas mientras estén activos: reparaciones, cortes
        programados o novedades.
      </p>

      <form onSubmit={create} className="mt-4 flex flex-col gap-3">
        <textarea
          required
          rows={2}
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ej: Hoy a las 23:00 haremos una mejora y el agente puede demorar unos minutos."
          className="input"
        />
        <div className="flex items-center gap-3">
          <select value={level} onChange={(e) => setLevel(e.target.value as AnnouncementLevel)} className="input w-auto">
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? 'Publicando…' : 'Publicar aviso'}
          </button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>

      {initial.length > 0 && (
        <div className="mt-5 flex flex-col divide-y divide-gray-800 rounded-md border border-gray-800">
          {initial.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className={`text-sm ${item.active ? 'text-gray-200' : 'text-gray-600 line-through'}`}>{item.message}</p>
                <p className="text-xs text-gray-600">
                  {LEVELS.find((l) => l.value === item.level)?.label} ·{' '}
                  {new Date(item.createdAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
              <div className="flex shrink-0 gap-3 text-xs">
                <button onClick={() => toggle(item)} className="text-amber-400 hover:underline">
                  {item.active ? 'Ocultar' : 'Mostrar'}
                </button>
                <button onClick={() => remove(item)} className="text-gray-500 hover:text-danger">
                  Borrar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
