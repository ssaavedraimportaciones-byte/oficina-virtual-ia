'use client'

import Link from 'next/link'

interface PendingRow {
  approvalId: string
  documentId: string
  folio: string
  taskName: string
  workArea: string
  type: string
  requiredRole: string
  companyName: string
  createdByName: string
  createdAt: string
  waitingHours: number
}

interface Props {
  data: PendingRow[]
  loading?: boolean
}

const ROLE_LABELS: Record<string, string> = {
  SUPERVISOR: 'Supervisor',
  PREVENTIONIST: 'Prevencionista',
  CONTRACT_ADMIN: 'Admin. Contrato',
  MANAGER: 'Gerencia',
  SYSTEM_ADMIN: 'Admin.',
}

const TYPE_LABELS: Record<string, string> = {
  SAFETY_TALK: 'Charla',
  DET: 'DET',
  ART: 'ART',
  AST: 'AST',
  WORK_PERMIT: 'Permiso',
  LOTO: 'LOTO',
  HEIGHT_WORK: 'Altura',
  CONFINED_SPACE: 'Esp. Conf.',
  LIFTING_PLAN: 'Izaje',
  EQUIPMENT_CHECKLIST: 'Checklist',
  OTHER: 'Otro',
}

function urgencyColor(hours: number): string {
  if (hours > 48) return 'text-red-400'
  if (hours > 24) return 'text-orange-400'
  return 'text-gray-400'
}

function formatWait(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

export default function PendingApprovalsTable({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="py-10 text-center text-gray-600 text-sm">
        No hay aprobaciones pendientes
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Folio</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Tarea</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Tipo</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Área</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Empresa</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Rol req.</th>
            <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Espera</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {data.map((row) => (
            <tr key={row.approvalId} className="hover:bg-gray-800/40 transition-colors group">
              <td className="py-2.5 px-3">
                <Link
                  href={`/documents/${row.documentId}`}
                  className="font-mono text-xs text-amber-400 hover:text-amber-300 group-hover:underline"
                >
                  {row.folio}
                </Link>
              </td>
              <td className="py-2.5 px-3 max-w-[200px]">
                <p className="text-gray-200 truncate">{row.taskName}</p>
                <p className="text-xs text-gray-500 truncate">{row.createdByName}</p>
              </td>
              <td className="py-2.5 px-3 hidden md:table-cell">
                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                  {TYPE_LABELS[row.type] ?? row.type}
                </span>
              </td>
              <td className="py-2.5 px-3 text-xs text-gray-400 hidden lg:table-cell max-w-[140px] truncate">
                {row.workArea}
              </td>
              <td className="py-2.5 px-3 text-xs text-gray-400 hidden lg:table-cell max-w-[140px] truncate">
                {row.companyName}
              </td>
              <td className="py-2.5 px-3">
                <span className="text-xs bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {ROLE_LABELS[row.requiredRole] ?? row.requiredRole}
                </span>
              </td>
              <td className={`py-2.5 px-3 text-right text-xs font-mono font-semibold ${urgencyColor(row.waitingHours)}`}>
                {formatWait(row.waitingHours)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
