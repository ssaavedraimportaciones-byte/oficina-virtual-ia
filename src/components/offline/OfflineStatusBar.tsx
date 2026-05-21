'use client'

import { useOfflineSync } from '@/hooks/useOfflineSync'
import type { NetworkStatus } from '@/modules/offline'

const STATUS_CONFIG: Record<
  NetworkStatus,
  { label: string; dot: string; bar: string; icon: string }
> = {
  online:      { label: 'En línea',      dot: 'bg-green-500',  bar: 'bg-green-500/10 border-green-800/30 text-green-400',  icon: '●' },
  offline:     { label: 'Sin conexión',  dot: 'bg-red-500 animate-pulse', bar: 'bg-red-950/60 border-red-800/50 text-red-400',   icon: '◌' },
  syncing:     { label: 'Sincronizando', dot: 'bg-amber-500 animate-pulse', bar: 'bg-amber-950/40 border-amber-800/30 text-amber-400', icon: '↻' },
  synced:      { label: 'Sincronizado',  dot: 'bg-green-500',  bar: 'bg-green-950/30 border-green-800/20 text-green-400',  icon: '✓' },
  conflict:    { label: 'Conflicto',     dot: 'bg-orange-500 animate-pulse', bar: 'bg-orange-950/60 border-orange-800/50 text-orange-400', icon: '!' },
}

interface Props {
  /** Compact mode for sidebar — shows dot only, expands on hover */
  compact?: boolean
  onConflictClick?: () => void
}

export default function OfflineStatusBar({ compact = false, onConflictClick }: Props) {
  const { status, pendingCount, conflictCount, triggerSync } = useOfflineSync()
  const cfg = STATUS_CONFIG[status]

  if (compact) {
    return (
      <button
        title={`${cfg.label}${pendingCount > 0 ? ` · ${pendingCount} pendientes` : ''}${conflictCount > 0 ? ` · ${conflictCount} conflictos` : ''}`}
        onClick={status === 'conflict' ? onConflictClick : status === 'online' ? triggerSync : undefined}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors w-full"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
        <span className="text-xs text-gray-400 truncate">{cfg.label}</span>
        {pendingCount > 0 && (
          <span className="ml-auto text-xs bg-amber-900 text-amber-300 rounded-full px-1.5 min-w-[18px] text-center">
            {pendingCount}
          </span>
        )}
        {conflictCount > 0 && (
          <span className="ml-auto text-xs bg-orange-900 text-orange-300 rounded-full px-1.5 min-w-[18px] text-center">
            {conflictCount}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${cfg.bar}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className="font-medium">{cfg.label}</span>

      {pendingCount > 0 && (
        <span className="text-xs opacity-70">· {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</span>
      )}

      {status === 'conflict' && conflictCount > 0 && (
        <button
          onClick={onConflictClick}
          className="ml-auto text-xs underline opacity-80 hover:opacity-100"
        >
          Ver {conflictCount} conflicto{conflictCount !== 1 ? 's' : ''}
        </button>
      )}

      {status === 'online' && pendingCount > 0 && (
        <button
          onClick={triggerSync}
          className="ml-auto text-xs underline opacity-80 hover:opacity-100"
        >
          Sincronizar
        </button>
      )}

      {status === 'offline' && (
        <span className="ml-auto text-xs opacity-60">Sin conexión</span>
      )}
    </div>
  )
}
