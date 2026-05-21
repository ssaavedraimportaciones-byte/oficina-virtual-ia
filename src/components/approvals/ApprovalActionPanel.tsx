'use client'

import { useState } from 'react'
import type { FlowProgress, ApprovalResult } from '@/modules/approvals'

interface Props {
  documentId: string
  progress: FlowProgress[]
  userRole: string
  userId: string
  onDecision: (result: ApprovalResult) => void
}

type Action = 'approve' | 'reject' | 'observe'

const ACTION_CONFIG: Record<
  Action,
  { label: string; icon: string; requiresComment: boolean; buttonClass: string }
> = {
  approve: {
    label: 'Aprobar',
    icon: '✓',
    requiresComment: false,
    buttonClass: 'bg-green-700 hover:bg-green-600 text-white',
  },
  reject: {
    label: 'Rechazar',
    icon: '✕',
    requiresComment: true,
    buttonClass: 'bg-red-800 hover:bg-red-700 text-white',
  },
  observe: {
    label: 'Observar',
    icon: '⚠',
    requiresComment: true,
    buttonClass: 'bg-orange-800 hover:bg-orange-700 text-white',
  },
}

export default function ApprovalActionPanel({
  documentId,
  progress,
  userRole,
  userId,
  onDecision,
}: Props) {
  const [selectedAction, setSelectedAction] = useState<Action | null>(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Find the pending step for this user's role
  const myStep = progress.find(
    (p) =>
      p.status === 'PENDING' &&
      p.step.requiredRole === userRole &&
      !p.step.nonBlocking
  )

  // Check prior steps are all done
  const priorPending = myStep
    ? progress.some(
        (p) =>
          p.step.order < myStep.step.order &&
          !p.step.nonBlocking &&
          p.status === 'PENDING'
      )
    : false

  // User already acted (dual-role guard display)
  const alreadyActed =
    userRole !== 'SYSTEM_ADMIN' &&
    progress.some(
      (p) => p.approvalId !== null && p.approverName !== null && p.status !== 'PENDING'
    )

  if (!myStep) return null
  if (priorPending) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-500">
        ⏳ Esperando que pasos anteriores sean completados para desbloquear su aprobación.
      </div>
    )
  }
  if (alreadyActed) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-500">
        Ya registró una decisión en este flujo de aprobación.
      </div>
    )
  }

  async function submit() {
    if (!selectedAction || !myStep?.approvalId) return
    const cfg = ACTION_CONFIG[selectedAction]
    if (cfg.requiresComment && !comment.trim()) {
      setError(`${cfg.label} requiere un comentario.`)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/documents/${documentId}/approvals/${myStep.approvalId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: selectedAction, comment: comment.trim() || undefined }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al procesar')
      onDecision(data.result as ApprovalResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-amber-800/40 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-amber-400 text-sm font-semibold">Su turno para revisar</span>
        <span className="text-xs bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded-full">
          {myStep.step.label}
        </span>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-2">
        {(Object.entries(ACTION_CONFIG) as [Action, (typeof ACTION_CONFIG)[Action]][]).map(
          ([action, cfg]) => (
            <button
              key={action}
              onClick={() => setSelectedAction(selectedAction === action ? null : action)}
              disabled={loading}
              className={`py-2.5 rounded-xl text-sm font-medium transition-all border ${
                selectedAction === action
                  ? `${cfg.buttonClass} border-transparent ring-2 ring-white/20`
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
              }`}
            >
              {cfg.icon} {cfg.label}
            </button>
          )
        )}
      </div>

      {/* Comment area */}
      {selectedAction && (
        <div className="space-y-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              ACTION_CONFIG[selectedAction].requiresComment
                ? `Comentario obligatorio para ${ACTION_CONFIG[selectedAction].label.toLowerCase()}…`
                : 'Comentario opcional…'
            }
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-600 resize-none"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => { setSelectedAction(null); setComment(''); setError(null) }}
              disabled={loading}
              className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={loading}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                ACTION_CONFIG[selectedAction].buttonClass
              } disabled:opacity-50`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                  Procesando…
                </span>
              ) : (
                `Confirmar ${ACTION_CONFIG[selectedAction].label}`
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
