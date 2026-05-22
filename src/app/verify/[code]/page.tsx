import type { Metadata } from 'next'
import Link from 'next/link'
import { verifyDocument } from '@/modules/pdf'

interface Props {
  params: Promise<{ code: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: 'Verificar documento — SafeCheck AI' }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  APPROVED: { label: 'APROBADO', color: 'text-green-300', bg: 'bg-green-950 border-green-800', icon: '✅' },
  CLOSED: { label: 'CERRADO', color: 'text-blue-300', bg: 'bg-blue-950 border-blue-800', icon: '🔒' },
  ARCHIVED: { label: 'ARCHIVADO', color: 'text-gray-400', bg: 'bg-gray-900 border-gray-700', icon: '📦' },
}

const DOC_TYPE_LABELS: Record<string, string> = {
  SAFETY_TALK: 'Charla de Seguridad',
  DET: 'DET',
  ART: 'ART',
  AST: 'AST',
  WORK_PERMIT: 'Permiso de Trabajo',
  LOTO: 'LOTO',
  HEIGHT_WORK: 'Trabajo en Altura',
  CONFINED_SPACE: 'Espacio Confinado',
  LIFTING_PLAN: 'Plan de Izaje',
  EQUIPMENT_CHECKLIST: 'Checklist de Equipos',
  OTHER: 'Otro',
}

export default async function VerifyPage({ params }: Props) {
  const { code } = await params
  const doc = await verifyDocument(code)

  if (!doc) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-5xl">❌</div>
          <h1 className="text-2xl font-bold text-white">Código inválido</h1>
          <p className="text-gray-400">
            Este código QR no corresponde a ningún documento registrado en SafeCheck AI.
            Puede haber sido alterado o no pertenece a este sistema.
          </p>
          <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-sm text-red-300">
            ⚠️ Si recibió este documento, solicite una versión válida al emisor.
          </div>
          <Link
            href="/"
            className="inline-block text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Ir al inicio →
          </Link>
        </div>
      </main>
    )
  }

  const cfg = STATUS_CONFIG[doc.status] ?? {
    label: doc.status,
    color: 'text-orange-300',
    bg: 'bg-orange-950 border-orange-800',
    icon: '⚠️',
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-5">
        {/* Brand */}
        <div className="text-center mb-2">
          <p className="text-amber-400 font-bold text-sm tracking-wide">SafeCheck AI</p>
          <p className="text-gray-500 text-xs mt-0.5">Verificación de documento oficial</p>
        </div>

        {/* Status banner */}
        <div className={`rounded-xl border p-5 text-center ${cfg.bg}`}>
          <div className="text-4xl mb-2">{cfg.icon}</div>
          <p className={`text-xl font-bold ${cfg.color}`}>{cfg.label}</p>
          <p className="text-sm text-gray-400 mt-1">
            {doc.isValid
              ? 'Este documento es auténtico y válido'
              : 'Este documento no está en estado válido para ejecución'}
          </p>
        </div>

        {/* Document info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
          {[
            ['Folio', doc.folio],
            ['Tarea / Actividad', doc.taskName],
            ['Faena / Área', doc.workArea],
            ['Empresa', doc.companyName],
            ['Fecha aprobación', doc.approvedAt
              ? new Date(doc.approvedAt).toLocaleDateString('es-CL', {
                  day: '2-digit', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })
              : '—'],
            ['Aprobado por', doc.approvedBy ?? '—'],
          ].map(([label, value]) => (
            <div key={label} className="px-5 py-3 flex items-start justify-between gap-4">
              <p className="text-xs text-gray-500 flex-shrink-0 w-36">{label}</p>
              <p className="text-sm text-gray-200 text-right flex-1">{value}</p>
            </div>
          ))}
        </div>

        {/* Hash */}
        {doc.documentHash && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Hash SHA-256 del documento</p>
            <p className="font-mono text-xs text-gray-400 break-all">{doc.documentHash}</p>
            <p className="text-xs text-gray-600 mt-2">
              Este código cambia si cualquier dato del documento es modificado.
              Compárelo con el hash impreso en el PDF para detectar alteraciones.
            </p>
          </div>
        )}

        {/* PDF download */}
        {doc.pdfUrl && (
          <a
            href={doc.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-3 bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold rounded-xl text-sm transition-colors"
          >
            📄 Descargar PDF original
          </a>
        )}

        <p className="text-center text-xs text-gray-600">
          Verificado en SafeCheck AI · {new Date().toLocaleDateString('es-CL')}
        </p>
      </div>
    </main>
  )
}
