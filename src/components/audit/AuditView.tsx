'use client'

import { useState, useCallback } from 'react'
import AuditFilters, { type AuditFilterValues } from './AuditFilters'
import AuditLogTable from './AuditLogTable'
import type { AuditLogEntry } from '@/modules/audit'

interface AuditData {
  logs: AuditLogEntry[]
  total: number
  limit: number
  offset: number
}

interface Props {
  isAdmin: boolean
}

const PAGE_SIZE = 100

export default function AuditView({ isAdmin }: Props) {
  const [data, setData] = useState<AuditData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [currentFilters, setCurrentFilters] = useState<AuditFilterValues>({
    documentId: '', userId: '', action: '', dateFrom: '', dateTo: '',
  })

  const fetchLogs = useCallback(async (filters: AuditFilterValues, pg: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.documentId) params.set('documentId', filters.documentId)
      if (filters.userId)     params.set('userId',     filters.userId)
      if (filters.action)     params.set('action',     filters.action)
      if (filters.dateFrom)   params.set('dateFrom',   filters.dateFrom)
      if (filters.dateTo)     params.set('dateTo',     filters.dateTo)
      params.set('limit',  String(PAGE_SIZE))
      params.set('offset', String(pg * PAGE_SIZE))

      const res = await fetch(`/api/audit?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error al cargar logs')
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  function handleFilter(filters: AuditFilterValues) {
    setCurrentFilters(filters)
    setPage(0)
    fetchLogs(filters, 0)
  }

  function handlePage(pg: number) {
    setPage(pg)
    fetchLogs(currentFilters, pg)
  }

  const exportParams = new URLSearchParams()
  if (currentFilters.documentId) exportParams.set('documentId', currentFilters.documentId)
  if (currentFilters.userId)     exportParams.set('userId',     currentFilters.userId)
  if (currentFilters.action)     exportParams.set('action',     currentFilters.action)
  if (currentFilters.dateFrom)   exportParams.set('dateFrom',   currentFilters.dateFrom)
  if (currentFilters.dateTo)     exportParams.set('dateTo',     currentFilters.dateTo)

  return (
    <div>
      <AuditFilters
        onFilter={handleFilter}
        isAdmin={isAdmin}
        exportUrl={`/api/audit/export?${exportParams}`}
      />

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
          Cargando registros...
        </div>
      )}

      {!loading && data && (
        <AuditLogTable
          logs={data.logs}
          total={data.total}
          page={page}
          pageSize={PAGE_SIZE}
          onPage={handlePage}
          isAdmin={isAdmin}
        />
      )}

      {!loading && !data && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm">Aplica un filtro para ver los registros de auditoría</p>
        </div>
      )}
    </div>
  )
}
