'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DocumentStatus, DocumentType } from '@/types/document'
import DocumentStatusBadge from './DocumentStatusBadge'
import { useAuth } from '@/contexts/auth-context'

const TYPE_LABELS: Record<DocumentType, string> = {
  SAFETY_TALK:       'Charla de Seguridad',
  DET:               'DET',
  ART:               'ART',
  AST:               'AST',
  WORK_PERMIT:       'Permiso de Trabajo',
  LOTO:              'LOTO',
  HEIGHT_WORK:       'Trabajo en Altura',
  CONFINED_SPACE:    'Espacio Confinado',
  LIFTING_PLAN:      'Plan de Izaje',
  EQUIPMENT_CHECKLIST: 'Checklist Equipos',
  OTHER:             'Otro',
}

const TRANSITIONS: Partial<Record<DocumentStatus, DocumentStatus[]>> = {
  DRAFT:             ['PENDING_SIGNATURE', 'ARCHIVED'],
  PENDING_SIGNATURE: ['PENDING_APPROVAL', 'OBSERVED'],
  PENDING_APPROVAL:  ['APPROVED', 'REJECTED', 'OBSERVED'],
  OBSERVED:          ['DRAFT'],
  APPROVED:          ['CLOSED', 'ARCHIVED'],
  REJECTED:          ['DRAFT', 'ARCHIVED'],
}

const TRANSITION_LABELS: Partial<Record<DocumentStatus, string>> = {
  PENDING_SIGNATURE: 'Enviar a Firma',
  PENDING_APPROVAL:  'Enviar a Aprobación',
  APPROVED:          'Aprobar',
  REJECTED:          'Rechazar',
  OBSERVED:          'Observar',
  CLOSED:            'Cerrar',
  ARCHIVED:          'Archivar',
  DRAFT:             'Volver a Borrador',
}

interface Props {
  id: string
  folio: string
  type: DocumentType
  status: DocumentStatus
  taskName: string
  workArea: string
  createdAt: string
}

export default function DocumentDetailHeader({
  id,
  folio,
  type,
  status,
  taskName,
  workArea,
  createdAt,
}: Props) {
  const { can } = useAuth()
  const router = useRouter()
  const [changing, setChanging] = useState(false)

  const availableTransitions = TRANSITIONS[status] ?? []

  async function changeStatus(newStatus: DocumentStatus) {
    setChanging(true)
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Error al cambiar estado')
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally {
      setChanging(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs text-gray-500 font-mono mb-1">{folio}</p>
          <h1 className="text-xl font-bold text-white">{taskName}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{workArea}</p>
        </div>
        <DocumentStatusBadge status={status} size="md" />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-400 mb-4">
        <span>
          <span className="text-gray-500">Tipo:</span>{' '}
          <span className="text-gray-300">{TYPE_LABELS[type]}</span>
        </span>
        <span>
          <span className="text-gray-500">Creado:</span>{' '}
          <span className="text-gray-300">
            {new Date(createdAt).toLocaleDateString('es-CL')}
          </span>
        </span>
      </div>

      {availableTransitions.length > 0 &&
        (can('documents:approve') || can('documents:observe') || can('documents:create')) && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-800">
            {availableTransitions.map((next) => (
              <button
                key={next}
                onClick={() => changeStatus(next)}
                disabled={changing}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  next === 'APPROVED'
                    ? 'bg-green-700 hover:bg-green-600 text-white'
                    : next === 'REJECTED'
                    ? 'bg-red-800 hover:bg-red-700 text-white'
                    : next === 'ARCHIVED'
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
              >
                {changing ? '...' : (TRANSITION_LABELS[next] ?? next)}
              </button>
            ))}
          </div>
        )}
    </div>
  )
}
