'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { DocumentSummary, DocumentStatus, DocumentType } from '@/types/document'
import DocumentCard from './DocumentCard'

interface Filters {
  type?: DocumentType
  status?: DocumentStatus
}

export default function DocumentList() {
  const [docs, setDocs] = useState<DocumentSummary[]>([])
  const [filters, setFilters] = useState<Filters>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.type) params.set('type', filters.type)
    if (filters.status) params.set('status', filters.status)

    fetch(`/api/documents?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setDocs(data.documents))
      .catch(() => setError('Error al cargar documentos'))
      .finally(() => setLoading(false))
  }, [filters])

  if (loading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-gray-800 rounded w-1/4 mb-2" />
            <div className="h-5 bg-gray-800 rounded w-3/4 mb-1" />
            <div className="h-4 bg-gray-800 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => setFilters({ ...filters })}
          className="mt-3 text-sm text-amber-400 hover:underline"
        >
          Reintentar
        </button>
      </div>
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
        <div className="text-center py-12">
          <p className="text-gray-500 mb-3">No hay documentos</p>
          <Link
            href="/documents/new"
            className="text-sm text-amber-400 hover:underline"
          >
            Crear el primero
          </Link>
        </div>
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
