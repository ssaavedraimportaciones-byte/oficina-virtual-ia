'use client'

import { useCallback, useEffect, useState } from 'react'
import { getUnresolvedConflicts } from '@/modules/offline/detectConflict'
import { resolveConflict } from '@/modules/offline/resolveConflict'
import type { ConflictInfo } from '@/modules/offline'

const CONFLICT_LABELS: Record<string, { title: string; description: string; canLocalWin: boolean }> = {
  SERVER_APPROVED: {
    title: 'Documento aprobado en servidor',
    description: 'El documento fue aprobado online mientras tenías una copia sin sincronizar.',
    canLocalWin: false,
  },
  SERVER_REJECTED: {
    title: 'Documento rechazado en servidor',
    description: 'El documento fue rechazado online. Tu copia local no puede sobrescribir un rechazo.',
    canLocalWin: false,
  },
  SERVER_CLOSED: {
    title: 'Documento cerrado en servidor',
    description: 'El documento ya fue cerrado. No es posible modificarlo.',
    canLocalWin: false,
  },
  FIELD_MISMATCH: {
    title: 'Cambios en conflicto',
    description: 'El documento fue editado en otro dispositivo mientras estabas sin conexión.',
    canLocalWin: true,
  },
}

interface Props {
  onClose: () => void
  onResolved?: () => void
}

export default function ConflictResolver({ onClose, onResolved }: Props) {
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([])
  const [resolving, setResolving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getUnresolvedConflicts()
      setConflicts(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleResolve(conflictId: string, strategy: 'server_wins' | 'local_wins') {
    setResolving(conflictId)
    setMessage(null)
    try {
      await resolveConflict(conflictId, strategy)
      setMessage({ type: 'ok', text: 'Conflicto resuelto correctamente.' })
      await load()
      onResolved?.()
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Error al resolver' })
    } finally {
      setResolving(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-white">Conflictos de sincronización</h2>
            <p className="text-xs text-gray-500 mt-0.5">Resolución necesaria antes de continuar</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-white transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-28 bg-gray-800 rounded-xl animate-pulse" />)}
            </div>
          )}

          {!loading && conflicts.length === 0 && (
            <div className="text-center py-10 text-gray-500 text-sm">
              ✓ No hay conflictos pendientes
            </div>
          )}

          {!loading && conflicts.map((c) => {
            const cfg = CONFLICT_LABELS[c.conflictType] ?? {
              title: c.conflictType,
              description: 'Conflicto desconocido.',
              canLocalWin: false,
            }
            const isProcessing = resolving === c.id

            return (
              <div key={c.id} className="bg-orange-950/30 border border-orange-800/50 rounded-xl p-4 space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-orange-400 text-sm font-semibold">⚠ {cfg.title}</span>
                  </div>
                  <p className="text-xs text-gray-400">{cfg.description}</p>
                </div>

                {/* Comparison */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-900 rounded-lg p-3">
                    <p className="text-gray-500 mb-1.5 font-medium uppercase tracking-wide text-[10px]">
                      Tu versión (offline)
                    </p>
                    <p className="text-gray-200">{c.localVersion.taskName}</p>
                    <p className="text-gray-500">{c.localVersion.workArea}</p>
                    <p className="text-amber-600 mt-1">Pendiente de sync</p>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3">
                    <p className="text-gray-500 mb-1.5 font-medium uppercase tracking-wide text-[10px]">
                      Versión servidor
                    </p>
                    <p className="text-gray-200">{c.serverVersion.taskName}</p>
                    <p className="text-gray-500">{c.serverVersion.workArea}</p>
                    <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      c.serverVersion.status === 'APPROVED'
                        ? 'bg-green-900 text-green-300'
                        : 'bg-gray-800 text-gray-400'
                    }`}>
                      {c.serverVersion.status}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    disabled={isProcessing}
                    onClick={() => handleResolve(c.id, 'server_wins')}
                    className="flex-1 py-2 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isProcessing ? '…' : 'Usar versión servidor'}
                  </button>
                  {cfg.canLocalWin && (
                    <button
                      disabled={isProcessing}
                      onClick={() => handleResolve(c.id, 'local_wins')}
                      className="flex-1 py-2 text-xs font-medium bg-amber-900 hover:bg-amber-800 text-amber-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? '…' : 'Usar mi versión'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Message */}
        {message && (
          <div className={`px-5 py-3 text-xs border-t ${
            message.type === 'ok'
              ? 'border-green-800 bg-green-950/40 text-green-300'
              : 'border-red-800 bg-red-950/40 text-red-300'
          }`}>
            {message.text}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
