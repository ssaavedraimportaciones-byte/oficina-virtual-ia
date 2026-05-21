'use client'

import { useEffect, useState } from 'react'

interface FailedRecord {
  id: string
  channel: string
  recipientId: string
  message: string | null
  createdAt: string
  recipient: { name: string; email: string }
}

interface Props {
  documentId: string
}

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: 'Email',
  SMS: 'WhatsApp/SMS',
  PUSH: 'Push',
  IN_APP: 'In-app',
}

export default function FailedNotificationsAlert({ documentId }: Props) {
  const [failed, setFailed] = useState<FailedRecord[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/notifications/failed?documentId=${documentId}`)
      .then((r) => r.json())
      .then((data: FailedRecord[]) => setFailed(data))
      .catch(() => setFailed([]))
      .finally(() => setLoading(false))
  }, [documentId])

  if (loading || failed.length === 0) return null

  return (
    <div className="mt-4 bg-orange-950 border border-orange-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-orange-300">
          ⚠️ {failed.length} notificación{failed.length !== 1 ? 'es' : ''} fallida{failed.length !== 1 ? 's' : ''}
        </span>
        <span className="text-orange-500 text-xs">{expanded ? '▲ ocultar' : '▼ ver detalle'}</span>
      </button>

      {expanded && (
        <div className="border-t border-orange-800 divide-y divide-orange-900">
          {failed.map((n) => {
            let detail: Record<string, unknown> = {}
            try { detail = JSON.parse(n.message ?? '{}') } catch { /* noop */ }

            return (
              <div key={n.id} className="px-4 py-3 text-xs text-orange-200">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{n.recipient.name}</span>
                  <span className="bg-orange-900 text-orange-300 px-2 py-0.5 rounded-full">
                    {CHANNEL_LABELS[n.channel] ?? n.channel}
                  </span>
                </div>
                <p className="text-orange-400 mt-0.5">{n.recipient.email}</p>
                {detail.error != null && (
                  <p className="text-orange-500 mt-1 font-mono truncate">{String(detail.error)}</p>
                )}
                <p className="text-orange-600 mt-0.5">
                  {new Date(n.createdAt).toLocaleString('es-CL')}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
