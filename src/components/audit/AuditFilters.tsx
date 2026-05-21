'use client'

import { useState } from 'react'
import type { AuditAction } from '@/modules/audit'

export interface AuditFilterValues {
  documentId: string
  userId: string
  action: string
  dateFrom: string
  dateTo: string
}

interface Props {
  onFilter: (filters: AuditFilterValues) => void
  isAdmin: boolean
  exportUrl: string
}

const ACTION_OPTIONS: { label: string; value: AuditAction | '' }[] = [
  { label: 'Todas', value: '' },
  { label: 'Login', value: 'LOGIN' },
  { label: 'Logout', value: 'LOGOUT' },
  { label: 'Documento creado', value: 'DOCUMENT_CREATED' },
  { label: 'Documento leído', value: 'DOCUMENT_READ' },
  { label: 'Documento editado', value: 'DOCUMENT_EDITED' },
  { label: 'Documento cerrado', value: 'DOCUMENT_CLOSED' },
  { label: 'Documento archivado', value: 'DOCUMENT_ARCHIVED' },
  { label: 'Escaneo', value: 'DOCUMENT_SCANNED' },
  { label: 'OCR ejecutado', value: 'OCR_EXECUTED' },
  { label: 'Clasificación IA', value: 'AI_CLASSIFICATION_EXECUTED' },
  { label: 'Reglas validadas', value: 'RULES_VALIDATED' },
  { label: 'Firmado', value: 'DOCUMENT_SIGNED' },
  { label: 'Flujo iniciado', value: 'APPROVAL_FLOW_STARTED' },
  { label: 'Comentario aprobación', value: 'APPROVAL_COMMENT' },
  { label: 'Aprobado', value: 'DOCUMENT_APPROVED' },
  { label: 'Rechazado', value: 'DOCUMENT_REJECTED' },
  { label: 'Observado', value: 'DOCUMENT_OBSERVED' },
  { label: 'PDF generado', value: 'PDF_GENERATED' },
  { label: 'Notificación enviada', value: 'NOTIFICATION_SENT' },
  { label: 'Notificación fallida', value: 'NOTIFICATION_FAILED' },
]

export default function AuditFilters({ onFilter, isAdmin, exportUrl }: Props) {
  const [filters, setFilters] = useState<AuditFilterValues>({
    documentId: '',
    userId: '',
    action: '',
    dateFrom: '',
    dateTo: '',
  })

  function update(key: keyof AuditFilterValues, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onFilter(filters)
  }

  function handleReset() {
    const empty: AuditFilterValues = { documentId: '', userId: '', action: '', dateFrom: '', dateTo: '' }
    setFilters(empty)
    onFilter(empty)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Acción</label>
          <select
            value={filters.action}
            onChange={(e) => update('action', e.target.value)}
            className="w-full bg-[#1f2937] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white"
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Desde</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => update('dateFrom', e.target.value)}
            className="w-full bg-[#1f2937] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Hasta</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => update('dateTo', e.target.value)}
            className="w-full bg-[#1f2937] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>

        {isAdmin && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Usuario (ID)</label>
            <input
              type="text"
              placeholder="cuid del usuario"
              value={filters.userId}
              onChange={(e) => update('userId', e.target.value)}
              className="w-full bg-[#1f2937] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
            />
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-400 mb-1">Documento (ID)</label>
          <input
            type="text"
            placeholder="cuid del documento"
            value={filters.documentId}
            onChange={(e) => update('documentId', e.target.value)}
            className="w-full bg-[#1f2937] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
          />
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
        >
          Filtrar
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 bg-[#1f2937] hover:bg-[#374151] text-gray-300 text-sm rounded-lg transition-colors"
        >
          Limpiar
        </button>
        {isAdmin && (
          <a
            href={exportUrl}
            className="ml-auto px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
          >
            Exportar CSV
          </a>
        )}
      </div>
    </form>
  )
}
