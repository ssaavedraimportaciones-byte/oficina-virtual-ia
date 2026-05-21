import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import AppShell from '@/components/layout/shell'
import { getPendingApprovals } from '@/modules/approvals'
import type { UserRole } from '@/types/user'

export const metadata: Metadata = { title: 'Aprobaciones Pendientes — SafeCheck AI' }

const FLOW_TYPE_LABELS: Record<string, string> = {
  SAFETY_TALK: 'Charla de Seguridad',
  DET: 'DET / ART / AST',
  CRITICAL: 'Trabajo Crítico',
  DEFAULT: 'Aprobación estándar',
}

const STEP_TYPE_ICONS: Record<string, string> = {
  SIGNATURE: '✍️',
  APPROVAL: '✅',
  NOTIFICATION: '📋',
}

const DOC_TYPE_LABELS: Record<string, string> = {
  SAFETY_TALK: 'Charla Seguridad',
  DET: 'DET',
  ART: 'ART',
  AST: 'AST',
  WORK_PERMIT: 'Permiso Trabajo',
  LOTO: 'LOTO',
  HEIGHT_WORK: 'Trabajo en Altura',
  CONFINED_SPACE: 'Espacio Confinado',
  LIFTING_PLAN: 'Plan de Izaje',
  EQUIPMENT_CHECKLIST: 'Checklist',
  OTHER: 'Otro',
}

export default async function ApprovalsPage() {
  const h = headers()
  const userId = h.get('x-user-id') ?? ''
  const role = (h.get('x-user-role') ?? 'WORKER') as UserRole

  const pending = await getPendingApprovals(userId, role)

  return (
    <AppShell>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Aprobaciones pendientes</h1>
            <p className="text-sm text-gray-500 mt-1">Documentos que requieren su revisión</p>
          </div>
          {pending.length > 0 && (
            <span className="bg-amber-500 text-gray-950 font-bold text-sm px-3 py-1 rounded-full">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
            <p className="text-3xl mb-3">✅</p>
            <p className="text-white font-medium">No hay aprobaciones pendientes</p>
            <p className="text-sm text-gray-500 mt-1">
              Todos los documentos en su cola están al día.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((item) => (
              <Link
                key={item.documentId}
                href={`/documents/${item.documentId}`}
                className="block bg-gray-900 border border-gray-800 hover:border-amber-700 rounded-xl p-5 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-amber-400 text-sm font-semibold">
                        {item.folio}
                      </span>
                      <span className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                        {DOC_TYPE_LABELS[item.documentType] ?? item.documentType}
                      </span>
                    </div>
                    <p className="text-white font-medium truncate">{item.taskName}</p>
                    <p className="text-sm text-gray-500">{item.workArea}</p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500">
                      {new Date(item.submittedAt).toLocaleDateString('es-CL', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {new Date(item.submittedAt).toLocaleTimeString('es-CL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span className="text-lg">{STEP_TYPE_ICONS[item.flowStep.type] ?? '•'}</span>
                  <div>
                    <p className="text-xs text-amber-300 font-medium">
                      Su paso: {item.flowStep.label}
                    </p>
                    <p className="text-xs text-gray-600">
                      Paso {item.flowStep.order} del flujo{' '}
                      {FLOW_TYPE_LABELS[item.flowStep.requiredRole] ?? ''}
                    </p>
                  </div>
                  <span className="ml-auto text-gray-600 group-hover:text-amber-400 transition-colors text-sm">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
