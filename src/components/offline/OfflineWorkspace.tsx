'use client'

import { useCallback, useEffect, useState } from 'react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { getDraftsForUser } from '@/modules/offline/saveLocalDraft'
import { isSupported } from '@/modules/offline/db'
import OfflineDocumentForm from './OfflineDocumentForm'
import ConflictResolver from './ConflictResolver'
import type { LocalDraft } from '@/modules/offline'
import Link from 'next/link'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Pendiente',     color: 'text-amber-400 bg-amber-950 border-amber-800' },
  syncing:  { label: 'Sincronizando', color: 'text-blue-400 bg-blue-950 border-blue-800' },
  synced:   { label: 'Sincronizado',  color: 'text-green-400 bg-green-950 border-green-800' },
  conflict: { label: 'Conflicto',     color: 'text-orange-400 bg-orange-950 border-orange-800' },
  error:    { label: 'Error',         color: 'text-red-400 bg-red-950 border-red-800' },
}

const DOC_TYPE_LABELS: Record<string, string> = {
  SAFETY_TALK: 'Charla', DET: 'DET', ART: 'ART', AST: 'AST',
  WORK_PERMIT: 'Permiso', LOTO: 'LOTO', HEIGHT_WORK: 'Altura',
  CONFINED_SPACE: 'Esp. Conf.', LIFTING_PLAN: 'Izaje',
  EQUIPMENT_CHECKLIST: 'Checklist', OTHER: 'Otro',
}

interface Props {
  userId: string
  companyId: string
}

export default function OfflineWorkspace({ userId, companyId }: Props) {
  const { isOnline } = useNetworkStatus()
  const { status, pendingCount, conflictCount, triggerSync, lastResult } = useOfflineSync()
  const [drafts, setDrafts] = useState<LocalDraft[]>([])
  const [view, setView] = useState<'list' | 'new'>('list')
  const [showConflicts, setShowConflicts] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const loadDrafts = useCallback(async () => {
    if (!isSupported()) return
    const list = await getDraftsForUser(userId)
    setDrafts(list)
  }, [userId])

  useEffect(() => { loadDrafts() }, [loadDrafts])

  async function handleSync() {
    setSyncing(true)
    await triggerSync()
    await loadDrafts()
    setSyncing(false)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Documentos offline</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Crea y firma documentos sin internet. Se sincronizan al recuperar conexión.
          </p>
        </div>
        <button
          onClick={() => setView(view === 'new' ? 'list' : 'new')}
          className="text-sm bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          {view === 'new' ? '← Lista' : '+ Nuevo'}
        </button>
      </div>

      {/* Status bar */}
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 mb-5 text-sm ${
        !isOnline   ? 'bg-red-950/40 border-red-800 text-red-300' :
        status === 'conflict' ? 'bg-orange-950/40 border-orange-800 text-orange-300' :
        status === 'syncing'  ? 'bg-blue-950/40 border-blue-800 text-blue-300' :
        status === 'synced'   ? 'bg-green-950/30 border-green-800 text-green-300' :
                                'bg-gray-900 border-gray-800 text-gray-400'
      }`}>
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
          !isOnline   ? 'bg-red-500 animate-pulse' :
          status === 'conflict' ? 'bg-orange-500 animate-pulse' :
          status === 'syncing'  ? 'bg-blue-500 animate-pulse' :
          status === 'synced'   ? 'bg-green-500' :
                                  'bg-green-500'
        }`} />
        <span className="font-medium flex-1">
          {!isOnline ? 'Sin conexión — modo offline activo' :
           status === 'conflict' ? `${conflictCount} conflicto${conflictCount !== 1 ? 's' : ''} por resolver` :
           status === 'syncing'  ? 'Sincronizando…' :
           status === 'synced'   ? 'Todo sincronizado' :
           pendingCount > 0 ? `${pendingCount} acción${pendingCount !== 1 ? 'es' : ''} pendiente${pendingCount !== 1 ? 's' : ''}` :
                              'En línea'}
        </span>

        {isOnline && status === 'conflict' && (
          <button onClick={() => setShowConflicts(true)} className="text-xs underline">
            Resolver
          </button>
        )}
        {isOnline && pendingCount > 0 && status !== 'conflict' && status !== 'syncing' && (
          <button onClick={handleSync} disabled={syncing} className="text-xs underline disabled:opacity-50">
            {syncing ? 'Sincronizando…' : 'Sincronizar'}
          </button>
        )}
      </div>

      {/* Last sync result */}
      {lastResult && lastResult.attempted > 0 && (
        <div className="mb-4 text-xs text-gray-600 border border-gray-800 rounded-lg px-3 py-2">
          Última sync: {lastResult.succeeded}/{lastResult.attempted} correctas
          {lastResult.conflicts > 0 && ` · ${lastResult.conflicts} conflictos`}
          {lastResult.failed > 0 && ` · ${lastResult.failed} errores`}
        </div>
      )}

      {/* New document form */}
      {view === 'new' && (
        <div className="mb-6">
          <OfflineDocumentForm
            userId={userId}
            companyId={companyId}
            onSaved={(draft) => {
              loadDrafts()
              setView('list')
            }}
          />
        </div>
      )}

      {/* Drafts list */}
      {view === 'list' && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Borradores locales ({drafts.length})
          </h2>

          {!isSupported() && (
            <div className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-xl p-4">
              Este navegador no soporta almacenamiento offline.
            </div>
          )}

          {isSupported() && drafts.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm">No hay documentos guardados localmente.</p>
              <button
                onClick={() => setView('new')}
                className="mt-4 text-sm text-amber-500 hover:text-amber-400"
              >
                Crear primer documento →
              </button>
            </div>
          )}

          <div className="space-y-2">
            {drafts.map((d) => {
              const sc = STATUS_LABEL[d.syncStatus] ?? STATUS_LABEL['pending']
              return (
                <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs text-gray-500">{d.folio}</span>
                        <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                          {DOC_TYPE_LABELS[d.type] ?? d.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-200 truncate">{d.taskName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{d.workArea}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${sc.color}`}>
                        {sc.label}
                      </span>
                      {d.serverId && (
                        <Link
                          href={`/documents/${d.serverId}`}
                          className="text-xs text-amber-500 hover:text-amber-400"
                        >
                          Ver en servidor →
                        </Link>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-700 mt-2">
                    {new Date(d.createdAt).toLocaleDateString('es-CL', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                    {d.syncedAt && ` · sync ${new Date(d.syncedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {showConflicts && (
        <ConflictResolver
          onClose={() => setShowConflicts(false)}
          onResolved={() => { setShowConflicts(false); loadDrafts() }}
        />
      )}
    </div>
  )
}
