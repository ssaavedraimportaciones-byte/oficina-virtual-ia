import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db/client'
import AppShell from '@/components/layout/shell'
import DocumentDetailHeader from '@/components/documents/DocumentDetailHeader'
import DocumentTimeline from '@/components/documents/DocumentTimeline'
import AIClassificationPanel from '@/components/documents/AIClassificationPanel'
import ValidationResultPanel from '@/components/documents/ValidationResultPanel'
import RequiredSignaturesStatus from '@/components/signatures/RequiredSignaturesStatus'
import ApprovalSection from '@/components/approvals/ApprovalSection'
import FieldConfidenceBadge from '@/components/scanner/FieldConfidenceBadge'
import type { EvaluationResult } from '@/modules/rules-engine'
import Link from 'next/link'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props) {
  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: { folio: true, taskName: true },
  })
  return { title: doc ? `${doc.folio} — ${doc.taskName}` : 'Documento' }
}

export default async function DocumentDetailPage({ params }: Props) {
  const h = headers()
  const userId = h.get('x-user-id') ?? ''
  const userRole = h.get('x-user-role') ?? 'WORKER'

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true, role: true } },
      supervisor: { select: { name: true, role: true } },
      auditLogs: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { name: true, role: true } } },
      },
      fields: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!doc) notFound()

  const timelineEntries = doc.auditLogs.map((log) => ({
    id: log.id,
    action: log.action,
    metadata: log.metadata as Record<string, unknown> | null,
    ipAddress: log.ipAddress,
    createdAt: log.createdAt.toISOString(),
    user: { name: log.user.name, role: log.user.role },
  }))

  return (
    <AppShell>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/documents" className="text-gray-400 hover:text-white text-sm transition-colors">
            ← Documentos
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-gray-300 text-sm font-mono">{doc.folio}</span>
          <div className="ml-auto">
            <Link
              href={`/documents/${doc.id}/scan`}
              className="flex items-center gap-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              <span>🔍</span> Escanear
            </Link>
          </div>
        </div>

        <DocumentDetailHeader
          id={doc.id}
          folio={doc.folio}
          type={doc.type as import('@/types/document').DocumentType}
          status={doc.status as import('@/types/document').DocumentStatus}
          taskName={doc.taskName}
          workArea={doc.workArea}
          createdAt={doc.createdAt.toISOString()}
        />

        {doc.fields.length > 0 && (
          <section className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">Campos del documento</h2>
              {doc.fields.some((f) => f.confidence !== null && f.confidence < 0.8) && (
                <span className="text-xs bg-orange-950 text-orange-300 border border-orange-800 px-2 py-1 rounded-full">
                  ⚠️ Revisión requerida
                </span>
              )}
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
              {doc.fields.map((field) => (
                <div key={field.id} className="px-4 py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">{field.fieldName}</p>
                    <p className="text-sm text-gray-200">{field.fieldValue ?? '—'}</p>
                  </div>
                  <FieldConfidenceBadge confidence={field.confidence} size="xs" />
                </div>
              ))}
            </div>
          </section>
        )}

        <ValidationResultPanel
          documentId={doc.id}
          initialResult={doc.validationResult as EvaluationResult | null}
        />

        <RequiredSignaturesStatus
          documentId={doc.id}
          documentStatus={doc.status}
        />

        <ApprovalSection
          documentId={doc.id}
          documentStatus={doc.status}
          userRole={userRole}
          userId={userId}
        />

        <AIClassificationPanel documentId={doc.id} />

        <section className="mt-6">
          <h2 className="text-lg font-semibold text-white mb-3">Historial de actividad</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <DocumentTimeline entries={timelineEntries} />
          </div>
        </section>
      </div>
    </AppShell>
  )
}
