import type { DocumentStatus } from '@/types/document'

const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; className: string }
> = {
  DRAFT:              { label: 'Borrador',           className: 'bg-gray-700 text-gray-300' },
  SCANNED:            { label: 'Escaneado',          className: 'bg-blue-900 text-blue-300' },
  AI_REVIEW:          { label: 'Revisión IA',        className: 'bg-purple-900 text-purple-300' },
  OBSERVED:           { label: 'Observado',          className: 'bg-orange-900 text-orange-300' },
  PENDING_SIGNATURE:  { label: 'Pend. Firma',        className: 'bg-yellow-900 text-yellow-300' },
  PENDING_APPROVAL:   { label: 'Pend. Aprobación',   className: 'bg-amber-900 text-amber-300' },
  APPROVED:           { label: 'Aprobado',           className: 'bg-green-900 text-green-300' },
  REJECTED:           { label: 'Rechazado',          className: 'bg-red-900 text-red-300' },
  CLOSED:             { label: 'Cerrado',            className: 'bg-gray-800 text-gray-400' },
  ARCHIVED:           { label: 'Archivado',          className: 'bg-gray-800 text-gray-500' },
}

interface Props {
  status: DocumentStatus
  size?: 'sm' | 'md'
}

export default function DocumentStatusBadge({ status, size = 'sm' }: Props) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-gray-700 text-gray-300' }
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.className} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
    >
      {config.label}
    </span>
  )
}
