'use client'

import type { ApprovalFlow, FlowProgress } from '@/modules/approvals'

interface Props {
  flow: ApprovalFlow
  progress: FlowProgress[]
  documentStatus: string
}

const STATUS_CONFIG = {
  PENDING: { icon: '○', color: 'text-gray-500', bg: 'bg-gray-800 border-gray-700', label: 'Pendiente' },
  APPROVED: { icon: '✓', color: 'text-green-400', bg: 'bg-green-950 border-green-800', label: 'Aprobado' },
  REJECTED: { icon: '✕', color: 'text-red-400', bg: 'bg-red-950 border-red-800', label: 'Rechazado' },
  OBSERVED: { icon: '⚠', color: 'text-orange-400', bg: 'bg-orange-950 border-orange-800', label: 'Observado' },
}

const STEP_TYPE_ICONS: Record<string, string> = {
  SIGNATURE: '✍️',
  APPROVAL: '✅',
  NOTIFICATION: '📋',
}

const ROLE_LABELS: Record<string, string> = {
  WORKER: 'Trabajador',
  SUPERVISOR: 'Supervisor',
  PREVENTIONIST: 'Prevencionista',
  CONTRACT_ADMIN: 'Admin. Contratos',
  MANAGER: 'Gerente',
  AUDITOR: 'Auditor',
  SYSTEM_ADMIN: 'Administrador',
}

export default function ApprovalFlowStatus({ flow, progress, documentStatus }: Props) {
  return (
    <div className="space-y-0">
      {/* Flow type header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
          Flujo: {flow.flowType}
        </span>
        <span className="text-xs text-gray-600">
          {flow.steps.filter((s) => !s.nonBlocking).length} paso(s) bloqueante(s)
        </span>
      </div>

      {progress.map((p, i) => {
        const cfg = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING
        const isLocked =
          i > 0 &&
          progress[i - 1].status === 'PENDING' &&
          !flow.steps[i - 1]?.nonBlocking

        return (
          <div key={p.step.order} className="relative">
            {/* Connector line */}
            {i < progress.length - 1 && (
              <div className="absolute left-4 top-10 bottom-0 w-px bg-gray-800 z-0" />
            )}

            <div
              className={`relative z-10 flex items-start gap-4 p-4 rounded-xl border mb-3 transition-all ${
                isLocked ? 'opacity-40' : cfg.bg
              }`}
            >
              {/* Step icon */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold ${
                  isLocked
                    ? 'bg-gray-800 border-gray-700 text-gray-600'
                    : `${cfg.bg} ${cfg.color} border-current`
                }`}
              >
                {cfg.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <span className="text-xs mr-1.5">{STEP_TYPE_ICONS[p.step.type] ?? '•'}</span>
                    <span className="text-sm font-medium text-gray-200">{p.step.label}</span>
                    {p.step.nonBlocking && (
                      <span className="ml-2 text-xs text-gray-600">(informativo)</span>
                    )}
                  </div>
                  <span className={`text-xs font-medium ${cfg.color} flex-shrink-0`}>
                    {cfg.label}
                  </span>
                </div>

                <p className="text-xs text-gray-500 mt-0.5">
                  Rol requerido: {ROLE_LABELS[p.step.requiredRole] ?? p.step.requiredRole}
                </p>

                {p.approverName && (
                  <p className="text-xs text-gray-400 mt-1">
                    Por: {p.approverName}
                    {p.decidedAt && (
                      <span className="text-gray-600 ml-1.5">
                        ·{' '}
                        {new Date(p.decidedAt).toLocaleDateString('es-CL', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </p>
                )}

                {p.comment && (
                  <div className="mt-2 bg-black/20 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-400 whitespace-pre-line">{p.comment}</p>
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
