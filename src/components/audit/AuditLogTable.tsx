'use client'

import type { AuditLogEntry } from '@/modules/audit'

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  LOGIN:                      { label: 'Login',           color: 'text-blue-400' },
  LOGOUT:                     { label: 'Logout',          color: 'text-gray-400' },
  DOCUMENT_CREATED:           { label: 'Creado',          color: 'text-green-400' },
  DOCUMENT_READ:              { label: 'Leído',           color: 'text-gray-400' },
  DOCUMENT_EDITED:            { label: 'Editado',         color: 'text-yellow-400' },
  DOCUMENT_CLOSED:            { label: 'Cerrado',         color: 'text-gray-500' },
  DOCUMENT_ARCHIVED:          { label: 'Archivado',       color: 'text-gray-500' },
  DOCUMENT_SCANNED:           { label: 'Escaneado',       color: 'text-cyan-400' },
  OCR_EXECUTED:               { label: 'OCR',             color: 'text-cyan-400' },
  AI_CLASSIFICATION_EXECUTED: { label: 'IA Clasificó',   color: 'text-purple-400' },
  RULES_VALIDATED:            { label: 'Reglas',          color: 'text-purple-400' },
  DOCUMENT_SIGNED:            { label: 'Firmado',         color: 'text-indigo-400' },
  APPROVAL_FLOW_STARTED:      { label: 'Flujo iniciado',  color: 'text-blue-300' },
  APPROVAL_COMMENT:           { label: 'Comentario',      color: 'text-gray-300' },
  DOCUMENT_APPROVED:          { label: 'Aprobado',        color: 'text-green-400' },
  DOCUMENT_REJECTED:          { label: 'Rechazado',       color: 'text-red-400' },
  DOCUMENT_OBSERVED:          { label: 'Observado',       color: 'text-amber-400' },
  PDF_GENERATED:              { label: 'PDF',             color: 'text-teal-400' },
  NOTIFICATION_SENT:          { label: 'Notif. enviada',  color: 'text-sky-400' },
  NOTIFICATION_FAILED:        { label: 'Notif. fallida',  color: 'text-red-400' },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })
}

interface Props {
  logs: AuditLogEntry[]
  total: number
  page: number
  pageSize: number
  onPage: (page: number) => void
  isAdmin: boolean
}

export default function AuditLogTable({ logs, total, page, pageSize, onPage, isAdmin }: Props) {
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-[#1f2937]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#111827] text-gray-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">Timestamp</th>
              <th className="px-4 py-3 text-left">Acción</th>
              <th className="px-4 py-3 text-left">Usuario</th>
              <th className="px-4 py-3 text-left">Rol</th>
              <th className="px-4 py-3 text-left">Documento</th>
              <th className="px-4 py-3 text-left">IP</th>
              {isAdmin && <th className="px-4 py-3 text-left">Metadata</th>}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-gray-500">
                  Sin registros para los filtros seleccionados
                </td>
              </tr>
            )}
            {logs.map((entry) => {
              const actionInfo = ACTION_LABELS[entry.action] ?? { label: entry.action, color: 'text-gray-300' }
              return (
                <tr key={entry.id} className="border-t border-[#1f2937] hover:bg-[#111827] transition-colors">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap font-mono text-xs">
                    {fmtDate(entry.createdAt)}
                  </td>
                  <td className={`px-4 py-3 font-medium whitespace-nowrap ${actionInfo.color}`}>
                    {actionInfo.label}
                  </td>
                  <td className="px-4 py-3 text-white">
                    <div>{entry.user?.name ?? '—'}</div>
                    <div className="text-gray-500 text-xs">{entry.user?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{entry.user?.role ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {entry.document ? (
                      <div>
                        <span className="font-mono text-xs text-blue-400">{entry.document.folio}</span>
                        <span className="ml-1 text-gray-500 text-xs">({entry.document.type})</span>
                      </div>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{entry.ipAddress ?? '—'}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">
                      {entry.metadata ? (
                        <details>
                          <summary className="cursor-pointer text-blue-400">Ver</summary>
                          <pre className="mt-1 text-[10px] overflow-auto max-h-32">
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : '—'}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
          <span>{total} registros totales</span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => onPage(page - 1)}
              className="px-3 py-1 bg-[#1f2937] rounded-lg disabled:opacity-40 hover:bg-[#374151] transition-colors"
            >
              Anterior
            </button>
            <span className="px-3 py-1">
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page + 1 >= totalPages}
              onClick={() => onPage(page + 1)}
              className="px-3 py-1 bg-[#1f2937] rounded-lg disabled:opacity-40 hover:bg-[#374151] transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
