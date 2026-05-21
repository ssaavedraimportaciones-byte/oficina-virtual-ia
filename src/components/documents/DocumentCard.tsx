import Link from 'next/link'
import type { DocumentSummary, DocumentType } from '@/types/document'
import DocumentStatusBadge from './DocumentStatusBadge'

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

interface Props {
  document: DocumentSummary
}

export default function DocumentCard({ document: doc }: Props) {
  return (
    <Link
      href={`/documents/${doc.id}`}
      className="block bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 hover:bg-gray-850 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 font-mono mb-1">{doc.folio}</p>
          <p className="font-medium text-white truncate">{doc.taskName}</p>
          <p className="text-sm text-gray-400 truncate mt-0.5">{doc.workArea}</p>
        </div>
        <DocumentStatusBadge status={doc.status} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
          {TYPE_LABELS[doc.type] ?? doc.type}
        </span>
        <span className="text-xs text-gray-500">
          {new Date(doc.createdAt).toLocaleDateString('es-CL')}
        </span>
      </div>
    </Link>
  )
}
