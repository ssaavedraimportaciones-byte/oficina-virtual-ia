'use client'

import { useEffect, useState, useCallback } from 'react'
import DashboardCard from './DashboardCard'
import DashboardFilters from './DashboardFilters'
import ComplianceChart from './ComplianceChart'
import PendingApprovalsTable from './PendingApprovalsTable'
import RiskSummaryTable from './RiskSummaryTable'
import CompanyComplianceRanking from './CompanyComplianceRanking'

interface Props {
  userRole: string
  canViewAll: boolean
}

interface StatsData {
  kpis: {
    createdToday: number
    approved: number
    rejected: number
    observed: number
    pendingSignature: number
    pendingApproval: number
    docsWithoutSignature: number
    avgApprovalHours: number | null
    criticalRisksCount: number
    total: number
  }
  complianceByArea: { area: string; total: number; approved: number; rate: number }[]
  complianceByCompany: {
    companyId: string; companyName: string
    total: number; approved: number; rejected: number; observed: number; rate: number
  }[]
  topErrors: { issue: string; count: number }[]
  criticalRisks: {
    documentId: string; folio: string; type: string
    workArea: string; companyName: string; blockingIssues: string[]
  }[]
  pendingApprovals: {
    approvalId: string; documentId: string; folio: string
    taskName: string; workArea: string; type: string
    requiredRole: string; companyName: string; createdByName: string
    createdAt: string; waitingHours: number
  }[]
  byType: { type: string; count: number }[]
  companies: { id: string; name: string }[]
}

function defaultFilters() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: now.toISOString().slice(0, 10),
    companyId: '',
    workArea: '',
    docType: '',
    status: '',
    createdBy: '',
  }
}

function buildQs(f: ReturnType<typeof defaultFilters>): string {
  const p = new URLSearchParams()
  if (f.dateFrom)  p.set('dateFrom',  f.dateFrom)
  if (f.dateTo)    p.set('dateTo',    f.dateTo)
  if (f.companyId) p.set('companyId', f.companyId)
  if (f.workArea)  p.set('workArea',  f.workArea)
  if (f.docType)   p.set('docType',   f.docType)
  if (f.status)    p.set('status',    f.status)
  if (f.createdBy) p.set('createdBy', f.createdBy)
  return p.toString()
}

export default function DashboardView({ canViewAll }: Props) {
  const [filters, setFilters] = useState(defaultFilters)
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchStats = useCallback(async (f: ReturnType<typeof defaultFilters>) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard/stats?${buildQs(f)}`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setData(await res.json())
      setLastRefresh(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced filter application
  useEffect(() => {
    const t = setTimeout(() => fetchStats(filters), 400)
    return () => clearTimeout(t)
  }, [filters, fetchStats])

  const kpis = data?.kpis

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Gerencial</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Actualizado {lastRefresh.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={() => fetchStats(filters)}
          disabled={loading}
          className="text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <span className={loading ? 'animate-spin' : ''}>↻</span>
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <DashboardFilters
        filters={filters}
        companies={data?.companies ?? []}
        onChange={setFilters}
        canViewAll={canViewAll}
      />

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <DashboardCard
          title="Creados hoy"
          value={kpis?.createdToday ?? null}
          icon="📋"
          color="amber"
          loading={loading && !kpis}
        />
        <DashboardCard
          title="Aprobados"
          value={kpis?.approved ?? null}
          subtitle={kpis ? `de ${kpis.total} total` : undefined}
          icon="✅"
          color="green"
          loading={loading && !kpis}
        />
        <DashboardCard
          title="Rechazados"
          value={kpis?.rejected ?? null}
          icon="❌"
          color="red"
          loading={loading && !kpis}
        />
        <DashboardCard
          title="Observados"
          value={kpis?.observed ?? null}
          icon="⚠️"
          color="orange"
          loading={loading && !kpis}
        />
        <DashboardCard
          title="Pend. firma"
          value={kpis?.pendingSignature ?? null}
          icon="✍️"
          color="blue"
          loading={loading && !kpis}
        />
        <DashboardCard
          title="Pend. aprobación"
          value={kpis?.pendingApproval ?? null}
          icon="📤"
          color="purple"
          loading={loading && !kpis}
        />
      </div>

      {/* Second KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <DashboardCard
          title="Sin firma"
          value={kpis?.docsWithoutSignature ?? null}
          subtitle="Documentos activos sin firmar"
          icon="🖊️"
          color="orange"
          loading={loading && !kpis}
        />
        <DashboardCard
          title="Riesgos críticos"
          value={kpis?.criticalRisksCount ?? null}
          subtitle="Con bloqueos activos"
          icon="🚨"
          color="red"
          loading={loading && !kpis}
        />
        <DashboardCard
          title="Tiempo prom. aprobación"
          value={kpis?.avgApprovalHours != null ? `${kpis.avgApprovalHours}h` : '—'}
          subtitle="Desde creación hasta aprobación"
          icon="⏱️"
          color="gray"
          loading={loading && !kpis}
        />
        <DashboardCard
          title="Total período"
          value={kpis?.total ?? null}
          icon="📁"
          color="gray"
          loading={loading && !kpis}
        />
      </div>

      {/* Compliance by area */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Cumplimiento por área de trabajo</h2>
        <ComplianceChart data={data?.complianceByArea ?? []} loading={loading && !data} />
      </section>

      {/* Middle row: pending approvals + company ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Aprobaciones pendientes</h2>
            {kpis && kpis.pendingApproval > 0 && (
              <span className="text-xs bg-purple-900 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-full">
                {kpis.pendingApproval}
              </span>
            )}
          </div>
          <PendingApprovalsTable data={data?.pendingApprovals ?? []} loading={loading && !data} />
        </section>

        {canViewAll && (
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Ranking de cumplimiento por empresa</h2>
            <CompanyComplianceRanking data={data?.complianceByCompany ?? []} loading={loading && !data} />
          </section>
        )}

        {!canViewAll && (
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Documentos por tipo</h2>
            {!data ? (
              <div className="h-48 bg-gray-800 rounded-xl animate-pulse" />
            ) : (
              <div className="space-y-2">
                {(data.byType ?? []).map((t) => {
                  const maxCount = data.byType[0]?.count ?? 1
                  const pct = Math.round((t.count / maxCount) * 100)
                  const TYPE_LABELS: Record<string, string> = {
                    SAFETY_TALK: 'Charla', DET: 'DET', ART: 'ART', AST: 'AST',
                    WORK_PERMIT: 'Permiso', LOTO: 'LOTO', HEIGHT_WORK: 'Altura',
                    CONFINED_SPACE: 'Esp. Conf.', LIFTING_PLAN: 'Izaje',
                    EQUIPMENT_CHECKLIST: 'Checklist', OTHER: 'Otro',
                  }
                  return (
                    <div key={t.type} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-28 flex-shrink-0">{TYPE_LABELS[t.type] ?? t.type}</span>
                      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500/70 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 font-mono w-8 text-right">{t.count}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Risks + errors */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Riesgos y errores detectados</h2>
        <RiskSummaryTable
          risks={data?.criticalRisks ?? []}
          topErrors={data?.topErrors ?? []}
          loading={loading && !data}
        />
      </section>
    </div>
  )
}
