'use client'

import { useState, useEffect, useCallback } from 'react'
import ApprovalFlowStatus from './ApprovalFlowStatus'
import ApprovalActionPanel from './ApprovalActionPanel'
import type { ApprovalFlow, FlowProgress, ApprovalResult } from '@/modules/approvals'

interface Props {
  documentId: string
  documentStatus: string
  userRole: string
  userId: string
}

interface FlowState {
  flow: ApprovalFlow
  progress: FlowProgress[]
  documentStatus: string
}

export default function ApprovalSection({
  documentId,
  documentStatus: initialStatus,
  userRole,
  userId,
}: Props) {
  const [state, setState] = useState<FlowState | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [docStatus, setDocStatus] = useState(initialStatus)

  const fetchFlow = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/approvals`)
      const data = await res.json()
      if (res.ok) setState(data as FlowState)
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    fetchFlow()
  }, [fetchFlow])

  async function startFlow() {
    setStarting(true)
    setError(null)
    try {
      const res = await fetch(`/api/documents/${documentId}/approvals`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al iniciar flujo')
      setDocStatus('PENDING_APPROVAL')
      await fetchFlow()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setStarting(false)
    }
  }

  function handleDecision(result: ApprovalResult) {
    setDocStatus(result.newDocumentStatus)
    fetchFlow()
  }

  const canStartFlow = ['DRAFT', 'SCANNED', 'AI_REVIEW', 'OBSERVED', 'REJECTED'].includes(docStatus)
  const isInFlow = docStatus === 'PENDING_APPROVAL'

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Flujo de aprobación</h2>
        {canStartFlow && (
          <button
            onClick={startFlow}
            disabled={starting}
            className="flex items-center gap-1.5 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            {starting ? (
              <>
                <span className="w-3.5 h-3.5 border border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
                Iniciando…
              </>
            ) : (
              <>▶ Iniciar flujo</>
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-sm text-red-300 mb-3">
          {error}
        </div>
      )}

      {loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex justify-center">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && !isInFlow && !canStartFlow && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
          <p className="text-2xl mb-2">
            {docStatus === 'APPROVED' ? '✅' : docStatus === 'REJECTED' ? '❌' : '📋'}
          </p>
          <p className="text-sm text-gray-400">
            {docStatus === 'APPROVED'
              ? 'Documento aprobado — no puede editarse, solo versionarse.'
              : docStatus === 'REJECTED'
                ? 'Documento rechazado. Vuelva a borrador para corregir.'
                : `Estado actual: ${docStatus}`}
          </p>
        </div>
      )}

      {!loading && canStartFlow && !isInFlow && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center text-sm text-gray-500">
          El documento aún no tiene flujo de aprobación activo.
          Presiona "Iniciar flujo" para comenzar el proceso.
        </div>
      )}

      {!loading && state && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <ApprovalFlowStatus
              flow={state.flow}
              progress={state.progress}
              documentStatus={docStatus}
            />
          </div>

          {isInFlow && (
            <ApprovalActionPanel
              documentId={documentId}
              progress={state.progress}
              userRole={userRole}
              userId={userId}
              onDecision={handleDecision}
            />
          )}
        </div>
      )}
    </section>
  )
}
