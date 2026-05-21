import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/client'
import AppShell from '@/components/layout/shell'
import DocumentDetailHeader from '@/components/documents/DocumentDetailHeader'
import DocumentTimeline from '@/components/documents/DocumentTimeline'
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
            <h2 className="text-lg font-semibold text-white mb-3">Campos del documento</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
              {doc.fields.map((field) => (
                <div key={field.id} className="px-4 py-3 flex justify-between items-start gap-4">
                  <span className="text-sm text-gray-400">{field.fieldName}</span>
                  <span className="text-sm text-gray-200 text-right">{field.fieldValue}</span>
                </div>
              ))}
            </div>
          </section>
        )}

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
