'use client'

import type { ApprovalStatus } from '@/types/document'

interface ApprovalStep {
  id: string
  approverId: string
  approverName: string
  approverRole: string
  status: ApprovalStatus
  comment?: string | null
  approvedAt?: string | Date | null
}

interface Props {
  approvals: ApprovalStep[]
  documentStatus: string
}

const ROLE_LABELS: Record<string, string> = {
  WORKER:          'Trabajador',
  SUPERVISOR:      'Supervisor',
  PREVENTIONIST:   'Prevencionista',
  CONTRACT_ADMIN:  'Admin. Contratos',
  MANAGER:         'Gerente',
  AUDITOR:         'Auditor',
  SYSTEM_ADMIN:    'Administrador',
}

const STATUS_CONFIG: Record<ApprovalStatus, { icon: string; color: string; bg: string; border: string; label: string }> = {
  PENDING:  { icon: '○', color: 'text-gray-400', bg: 'bg-gray-900', border: 'border-gray-700', label: 'Pendiente' },
  APPROVED: { icon: '✓', color: 'text-green-400', bg: 'bg-green-950', border: 'border-green-700', label: 'Aprobado' },
  REJECTED: { icon: '✕', color: 'text-red-400',   bg: 'bg-red-950',   border: 'border-red-700',   label: 'Rechazado' },
  OBSERVED: { icon: '⚠', color: 'text-orange-400',bg: 'bg-orange-950',border: 'border-orange-700',label: 'Observado' },
}

export default function ApprovalTimeline({ approvals, documentStatus }: Props) {
  if (approvals.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center text-sm text-gray-500">
        No hay aprobaciones registradas para este documento.
      </div>
    )
  }

  const pending = approvals.filter((a) => a.status === 'PENDING')
  const allApproved = approvals.every((a) => a.status === 'APPROVED')

  return (
    <div className="space-y-1">
      {/* Summary banner */}
      {pending.length > 0 ? (
        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-950 border border-amber-800 text-sm text-amber-300">
          <span className="font-semibold">Pendiente de aprobación:</span>{' '}
          {pending.map((a) => a.approverName || ROLE_LABELS[a.approverRole] || a.approverRole).join(', ')}
        </div>
      ) : allApproved ? (
        <div className="mb-4 px-4 py-3 rounded-xl bg-green-950 border border-green-800 text-sm text-green-300">
          ✅ Todas las aprobaciones completadas
        </div>
      ) : null}

      {/* Steps */}
      {approvals.map((step, i) => {
        const cfg = STATUS_CONFIG[step.status]
        return (
          <div key={step.id} className="relative">
            {i < approvals.length - 1 && (
              <div className="absolute left-4 top-10 h-full w-px bg-gray-800 z-0" />
            )}
            <div className={`relative z-10 flex gap-4 p-4 rounded-xl border mb-2 ${cfg.bg} ${cfg.border}`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                {cfg.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-200">
                    {step.approverName || '—'}
                    <span className="ml-1.5 text-xs text-gray-500">
                      · {ROLE_LABELS[step.approverRole] ?? step.approverRole}
                    </span>
                  </p>
                  <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                </div>
                {step.approvedAt && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(step.approvedAt).toLocaleString('es-CL', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                )}
                {step.comment && (
                  <div className="mt-2 bg-black/20 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-400 whitespace-pre-line">{step.comment}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
