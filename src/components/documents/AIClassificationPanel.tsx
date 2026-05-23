'use client'

import { useState } from 'react'
import type { AIClassificationResult } from '@/modules/ai-validation'
import ConfidenceBadge from '@/components/ui/ConfidenceBadge'

interface Props {
  documentId: string
}

const TYPE_LABELS: Record<string, string> = {
  CHARLA_DE_SEGURIDAD: 'Charla de Seguridad',
  DET: 'DET',
  ART: 'ART',
  PERMISO_DE_TRABAJO: 'Permiso de Trabajo',
  CHECK_LIST: 'Check List',
  ACTA_DE_REUNION: 'Acta de Reunión',
  INCIDENTE: 'Incidente',
  INVESTIGACION: 'Investigación',
  AUDITORIA: 'Auditoría',
  CAPACITACION: 'Capacitación',
  OTHER: 'Otro',
}

export default function AIClassificationPanel({ documentId }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AIClassificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleClassify() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/documents/${documentId}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Error al clasificar')
      }

      setResult(data.classification as AIClassificationResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Clasificación IA</h2>
        {!result && (
          <button
            onClick={handleClassify}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm bg-purple-900 hover:bg-purple-800 disabled:opacity-50 text-purple-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border border-purple-400 border-t-transparent rounded-full animate-spin inline-block" />
                Analizando…
              </>
            ) : (
              <>✨ Clasificar con IA</>
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-sm text-red-300">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 text-red-500 hover:text-red-300 transition-colors"
          >
            Cerrar
          </button>
        </div>
      )}

      {!result && !error && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center text-gray-500 text-sm">
          Presiona "Clasificar con IA" para analizar el documento con Claude.
        </div>
      )}

      {result && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
          {/* Low-confidence global warning */}
          {result.confidence < 0.8 && (
            <div className="px-5 py-3 bg-yellow-950 border-b border-yellow-800 rounded-t-xl">
              <p className="text-sm text-yellow-300 font-medium">
                ⚠️ Confianza baja — se recomienda revisión manual antes de aprobar
              </p>
            </div>
          )}

          {/* Type + confidence */}
          <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Tipo detectado</p>
              <p className="text-white font-semibold">
                {TYPE_LABELS[result.documentType] ?? result.documentType}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Confianza</p>
              <ConfidenceBadge confidence={result.confidence} />
            </div>
          </div>

          {/* Fields */}
          {Object.keys(result.fields).length > 0 && (
            <div className="px-5 py-4">
              <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Campos extraídos</p>
              <div className="space-y-2">
                {Object.entries(result.fields).map(([name, field]) => (
                  <div key={name} className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">{name}</p>
                      <p className="text-sm text-gray-200">
                        {field.value ?? <span className="text-gray-600 italic">—</span>}
                      </p>
                    </div>
                    {field.inferred && (
                      <span className="text-xs bg-amber-950 text-amber-400 border border-amber-800 px-1.5 py-0.5 rounded flex-shrink-0">
                        inferido
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing fields */}
          {result.missingFields.length > 0 && (
            <div className="px-5 py-3">
              <p className="text-xs text-orange-400 font-medium mb-1.5">
                ⚠️ Campos requeridos faltantes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.missingFields.map((f) => (
                  <span
                    key={f}
                    className="text-xs bg-orange-950 text-orange-300 border border-orange-800 px-2 py-0.5 rounded"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Observations */}
          {result.observations.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Observaciones IA</p>
              <ul className="space-y-1.5">
                {result.observations.map((obs, i) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-gray-600 flex-shrink-0">·</span>
                    <span>{obs}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="px-5 py-3 flex justify-end">
            <button
              onClick={() => setResult(null)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Reclasificar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
