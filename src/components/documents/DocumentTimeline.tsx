interface TimelineEntry {
  id: string
  action: string
  metadata?: Record<string, unknown> | null
  ipAddress?: string | null
  createdAt: string
  user: {
    name: string
    role: string
  }
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE:           { label: 'Documento creado',        color: 'text-blue-400' },
  UPDATE:           { label: 'Documento actualizado',   color: 'text-amber-400' },
  STATUS_CHANGE:    { label: 'Estado cambiado',         color: 'text-purple-400' },
  APPROVE:          { label: 'Aprobado',                color: 'text-green-400' },
  REJECT:           { label: 'Rechazado',               color: 'text-red-400' },
  OBSERVE:          { label: 'Observado',               color: 'text-orange-400' },
  SIGN:             { label: 'Firmado',                 color: 'text-cyan-400' },
  ARCHIVE:          { label: 'Archivado',               color: 'text-gray-400' },
  READ:             { label: 'Visualizado',             color: 'text-gray-500' },
}

interface Props {
  entries: TimelineEntry[]
}

export default function DocumentTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return <p className="text-sm text-gray-500 py-4">Sin actividad registrada.</p>
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-800" />

      {entries.map((entry, i) => {
        const config = ACTION_LABELS[entry.action] ?? {
          label: entry.action,
          color: 'text-gray-400',
        }

        return (
          <div key={entry.id} className="flex gap-4 relative">
            <div className="relative flex-shrink-0 mt-1.5">
              <div className="w-8 h-8 rounded-full bg-gray-900 border-2 border-gray-700 flex items-center justify-center z-10 relative">
                <span className="w-2 h-2 rounded-full bg-gray-600" />
              </div>
            </div>
            <div className={`pb-6 ${i === entries.length - 1 ? '' : ''}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mb-0.5">
                <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                <span className="text-xs text-gray-500">
                  {new Date(entry.createdAt).toLocaleString('es-CL')}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                {entry.user.name}{' '}
                <span className="text-gray-600">· {entry.user.role}</span>
              </p>
              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <p className="text-xs text-gray-600 mt-1 font-mono">
                  {JSON.stringify(entry.metadata, null, 0)}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
