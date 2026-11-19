'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export interface ConversationRow {
  id: string
  contactName: string
  channel: string
  status: string
  agentPaused: boolean
  lastText: string | null
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  simulador: 'Simulador',
}

const STATUS_STYLE: Record<string, string> = {
  abierta: 'text-amber-400 border-amber-500/40',
  calificada: 'text-success border-success/40',
  cerrada: 'text-gray-500 border-gray-700',
}

/** Lista de conversaciones con selección para borrar varias de una vez. */
export default function ConversationList({ businessId, rows }: { businessId: string; rows: ConversationRow[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allSelected = rows.length > 0 && selected.size === rows.length

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
  }

  async function removeSelected() {
    const n = selected.size
    const label = n === 1 ? 'esta conversación' : `estas ${n} conversaciones`
    if (!window.confirm(`¿Eliminar ${label}? Se borran sus mensajes y no se puede deshacer. Las horas, pedidos y reservas que salieron de ellas se mantienen.`)) {
      return
    }
    setDeleting(true)
    setError(null)
    const res = await fetch(`/api/businesses/${businessId}/conversations`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected] }),
    })
    setDeleting(false)
    if (!res.ok) {
      setError('No se pudieron eliminar. Intenta de nuevo.')
      return
    }
    setSelected(new Set())
    router.refresh()
  }

  return (
    <div>
      <div className="mb-3 flex min-h-10 flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-5 w-5 accent-amber-500"
          />
          Seleccionar todas
        </label>
        {selected.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {selected.size} {selected.size === 1 ? 'seleccionada' : 'seleccionadas'}
            </span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-sm text-gray-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={removeSelected}
              disabled={deleting}
              className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {deleting ? 'Eliminando…' : `Eliminar (${selected.size})`}
            </button>
          </div>
        )}
      </div>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <div className="flex flex-col divide-y divide-gray-800 rounded-lg border border-gray-800">
        {rows.map((row) => {
          const checked = selected.has(row.id)
          return (
            <div
              key={row.id}
              className={`flex items-center gap-4 px-5 py-4 ${checked ? 'bg-amber-500/5' : 'hover:bg-gray-900/60'}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(row.id)}
                aria-label={`Seleccionar conversación con ${row.contactName}`}
                className="h-5 w-5 shrink-0 accent-amber-500"
              />
              <Link
                href={`/panel/${businessId}/conversaciones/${row.id}`}
                className="flex min-w-0 flex-1 items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-white">{row.contactName}</span>
                    <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-400">
                      {CHANNEL_LABEL[row.channel] ?? row.channel}
                    </span>
                    {row.agentPaused && (
                      <span className="rounded-full border border-amber-700 px-2 py-0.5 text-xs text-amber-400">
                        Atiende una persona
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-gray-500">{row.lastText ?? 'Sin mensajes todavía'}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-3 py-1 text-xs ${STATUS_STYLE[row.status] ?? ''}`}>
                  {row.status}
                </span>
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
