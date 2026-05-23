'use client'

import { useEffect, useState, useCallback } from 'react'
import type { DocumentSummary, DocumentStatus, DocumentType } from '@/types/document'
import DocumentCard from './DocumentCard'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/Skeleton'

interface Filters {
  type?: DocumentType
  status?: DocumentStatus
}

export default function DocumentList() {
  const [docs, setDocs] = useState<DocumentSummary[]>([])
  const [filters, setFilters] = useState<Filters>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDocs = useCallback((f: Filters) => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (f.type) params.set('type', f.type)
    if (f.status) params.set('status', f.status)

    fetch(`/api/documents?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setDocs(data.documents))
      .catch(() => setError('Error al cargar documentos. Verifica tu conexión e intenta de nuevo.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadDocs(filters) }, [filters, loadDocs])

  if (loading) return <SkeletonList count={4} />

  if (error) {
    return (
      <EmptyState
        icon="⚠️"
        title="Error al cargar documentos"
        description={error}
        action={{ label: 'Reintentar', onClick: () => loadDocs(filters) }}
      />
    )
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          value={filters.type ?? ''}
          onChange={(e) =>
            setFilters((f) => ({ ...f, type: (e.target.value as DocumentType) || undefined }))
          }
          className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">Todos los tipos</option>
          <option value="SAFETY_TALK">Charla</option>
          <option value="DET">DET</option>
          <option value="ART">ART</option>
          <option value="WORK_PERMIT">Permiso</option>
          <option value="LOTO">LOTO</option>
          <option value="HEIGHT_WORK">Trabajo en Altura</option>
        </select>

        <select
          value={filters.status ?? ''}
          onChange={(e) =>
            setFilters((f) => ({ ...f, status: (e.target.value as DocumentStatus) || undefined }))
          }
          className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">Todos los estados</option>
          <option value="DRAFT">Borrador</option>
          <option value="PENDING_SIGNATURE">Pend. Firma</option>
          <option value="PENDING_APPROVAL">Pend. Aprobación</option>
          <option value="APPROVED">Aprobado</option>
          <option value="REJECTED">Rechazado</option>
        </select>
      </div>

      {docs.length === 0 ? (
        <EmptyState
          icon="📄"
          title="Sin documentos"
          description={
            filters.type || filters.status
              ? 'No hay documentos que coincidan con los filtros seleccionados.'
              : 'Aún no hay documentos. Crea el primero para comenzar.'
          }
          action={
            filters.type || filters.status
              ? { label: 'Limpiar filtros', onClick: () => setFilters({}) }
              : { label: 'Crear documento', href: '/documents/new' }
          }
        />
      ) : (
        <div className="grid gap-3">
          {docs.map((doc) => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      )}
    </div>
  )
}
