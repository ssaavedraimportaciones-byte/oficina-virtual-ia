'use client'

import Link from 'next/link'

interface RiskRow {
  documentId: string
  folio: string
  type: string
  workArea: string
  companyName: string
  blockingIssues: string[]
}

interface ErrorRow {
  issue: string
  count: number
}

interface Props {
  risks: RiskRow[]
  topErrors: ErrorRow[]
  loading?: boolean
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

export default function RiskSummaryTable({ risks, topErrors, loading }: Props) {
  if (loading) {
    return <div className="h-48 bg-gray-800 rounded-xl animate-pulse" />
  }

  return (
    <div className="space-y-6">
      {/* Top errors */}
      {topErrors.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Errores más frecuentes
          </h4>
          <div className="space-y-2">
            {topErrors.map((e, i) => {
              const maxCount = topErrors[0]?.count ?? 1
              const pct = Math.round((e.count / maxCount) * 100)
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-gray-300 truncate pr-2">{e.issue}</p>
                      <span className="text-xs text-red-400 font-mono flex-shrink-0">{e.count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500/70 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Critical documents */}
      {risks.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Documentos con riesgos críticos activos
          </h4>
          <div className="space-y-2">
            {risks.slice(0, 8).map((r) => (
              <div key={r.documentId} className="bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/documents/${r.documentId}`}
                        className="font-mono text-xs text-amber-400 hover:text-amber-300"
                      >
                        {r.folio}
                      </Link>
                      <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                        {TYPE_LABELS[r.type] ?? r.type}
                      </span>
                      <span className="text-xs text-gray-500 truncate">{r.workArea}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {r.blockingIssues.slice(0, 3).map((issue, j) => (
                        <span key={j} className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full">
                          {issue.length > 50 ? issue.slice(0, 48) + '…' : issue}
                        </span>
                      ))}
                      {r.blockingIssues.length > 3 && (
                        <span className="text-xs text-red-500">+{r.blockingIssues.length - 3} más</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0">{r.companyName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {risks.length === 0 && topErrors.length === 0 && (
        <p className="text-center text-gray-600 text-sm py-8">Sin riesgos críticos detectados</p>
      )}
    </div>
  )
}
