'use client'

import { useJobStatus, type JobStatus } from '@/hooks/useJobStatus'
import Spinner from '@/components/ui/Spinner'

interface Props {
  jobType: 'OCR' | 'PDF'
  statusUrl: string | null
  enabled?: boolean
  onCompleted?: (result: Record<string, unknown>) => void
  onFailed?: (error: string) => void
  onRetry?: () => void
}

const STATUS_CONFIG: Record<JobStatus, { icon: string; label: string; desc: string; className: string }> = {
  PENDING:   { icon: '⏳', label: 'En cola',        desc: 'Esperando procesamiento…',         className: 'bg-gray-900 border-gray-700 text-gray-400' },
  RUNNING:   { icon: '⚙️', label: 'Procesando',     desc: '',                                  className: 'bg-blue-950 border-blue-800 text-blue-300' },
  COMPLETED: { icon: '✅', label: 'Completado',     desc: 'Proceso finalizado correctamente.', className: 'bg-green-950 border-green-800 text-green-300' },
  FAILED:    { icon: '❌', label: 'Error',          desc: 'El proceso falló.',                 className: 'bg-red-950 border-red-800 text-red-300' },
}

const JOB_RUNNING_MESSAGES: Record<'OCR' | 'PDF', string> = {
  OCR: 'Procesando OCR — extrayendo campos del documento…',
  PDF: 'Generando PDF final — aplicando firma y QR…',
}

export default function JobStatusPanel({
  jobType,
  statusUrl,
  enabled = true,
  onCompleted,
  onFailed,
  onRetry,
}: Props) {
  const { status, result, error, isPolling, refetch } = useJobStatus({ statusUrl, enabled })

  // Notify parent on terminal state (called once via status change)
  if (status === 'COMPLETED' && result && onCompleted) onCompleted(result)
  if (status === 'FAILED' && error && onFailed) onFailed(error)

  if (!statusUrl || !enabled) return null

  const cfg = status ? STATUS_CONFIG[status] : STATUS_CONFIG.PENDING
  const runningMsg = status === 'RUNNING' ? JOB_RUNNING_MESSAGES[jobType] : cfg.desc

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${cfg.className}`}
    >
      <span className="text-lg flex-shrink-0 mt-0.5" aria-hidden>
        {isPolling && (status === 'PENDING' || status === 'RUNNING') ? (
          <Spinner size="sm" />
        ) : (
          cfg.icon
        )}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{jobType === 'OCR' ? 'OCR' : 'PDF'} — {cfg.label}</p>
        {runningMsg && <p className="text-xs opacity-80 mt-0.5">{runningMsg}</p>}
        {status === 'FAILED' && error && (
          <p className="text-xs mt-1 opacity-70">{error}</p>
        )}
      </div>
      {status === 'FAILED' && (
        <button
          onClick={onRetry ?? refetch}
          className="text-xs px-3 py-1.5 bg-red-800 hover:bg-red-700 text-red-200 rounded-lg transition-colors flex-shrink-0"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}
