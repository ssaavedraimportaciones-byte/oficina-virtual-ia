'use client'

import { useState } from 'react'
import type { EvaluationResult } from '@/modules/rules-engine'

interface Props {
  documentId: string
  initialResult?: EvaluationResult | null
}

const STATUS_LABELS: Record<string, string> = {
  SCANNED: 'Cumple — listo para firmas',
  PENDING_SIGNATURE: 'Pendiente de firma',
  OBSERVED: 'Observado — requiere correcciones',
  AI_REVIEW: 'En revisión',
}

const STATUS_COLORS: Record<string, string> = {
  SCANNED: 'bg-green-950 border-green-800 text-green-300',
  PENDING_SIGNATURE: 'bg-blue-950 border-blue-800 text-blue-300',
  OBSERVED: 'bg-orange-950 border-orange-800 text-orange-300',
  AI_REVIEW: 'bg-gray-800 border-gray-700 text-gray-300',
}

export default function ValidationResultPanel({ documentId, initialResult }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<EvaluationResult | null>(initialResult ?? null)
  const [error, setError] = useState<string | null>(null)

  async function handleValidate() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/documents/${documentId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Error al validar')

      setResult(data.validation as EvaluationResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const colorClass =
    result ? STATUS_COLORS[result.statusRecommendation] ?? STATUS_COLORS.AI_REVIEW : ''

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Motor de reglas</h2>
        <button
          onClick={handleValidate}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
              Evaluando…
            </>
          ) : (
            <>⚙️ {result ? 'Re-evaluar' : 'Evaluar reglas'}</>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-sm text-red-300 mb-3">
          {error}
        </div>
      )}

      {!result && !error && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center text-gray-500 text-sm">
          Presiona "Evaluar reglas" para verificar controles de seguridad obligatorios.
        </div>
      )}

      {result && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
          {/* Status banner */}
          <div className={`px-5 py-4 rounded-t-xl border ${colorClass} flex items-center justify-between gap-3 flex-wrap`}>
            <div>
              <p className="text-xs opacity-70 mb-0.5">Recomendación de estado</p>
              <p className="font-semibold">
                {STATUS_LABELS[result.statusRecommendation] ?? result.statusRecommendation}
              </p>
            </div>
            <span className={`text-lg ${result.passed ? '' : 'opacity-100'}`}>
              {result.passed ? '✅' : '❌'}
            </span>
          </div>

          {/* Blocking issues */}
          {result.blockingIssues.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-xs text-red-400 font-medium uppercase tracking-wide mb-2">
                Problemas bloqueantes
              </p>
              <ul className="space-y-1.5">
                {result.blockingIssues.map((issue, i) => (
                  <li key={i} className="text-sm text-red-300 flex gap-2">
                    <span className="text-red-700 flex-shrink-0">✕</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-xs text-yellow-400 font-medium uppercase tracking-wide mb-2">
                Advertencias
              </p>
              <ul className="space-y-1.5">
                {result.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-yellow-300 flex gap-2">
                    <span className="text-yellow-700 flex-shrink-0">⚠</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Required actions */}
          {result.requiredActions.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
                Acciones requeridas
              </p>
              <ul className="space-y-1.5">
                {result.requiredActions.map((action, i) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-amber-500 flex-shrink-0">→</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.passed && (
            <div className="px-5 py-3 text-sm text-green-400">
              Todas las reglas de seguridad aplicables fueron satisfechas.
            </div>
          )}
        </div>
      )}
    </section>
  )
}
