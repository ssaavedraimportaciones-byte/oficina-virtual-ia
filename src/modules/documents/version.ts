import { prisma } from '@/lib/db/client'

export interface VersionSnapshot {
  status: string
  taskName: string
  workArea: string
  type: string
  aiResult: unknown
  validationResult: unknown
  fields: Array<{ fieldName: string; fieldValue: string | null; confidence: number | null }>
}

export interface DocumentVersionRecord {
  id: string
  documentId: string
  version: number
  snapshot: VersionSnapshot
  createdAt: string
  createdById: string
  createdBy?: { name: string; role: string }
}

export async function createDocumentVersion(
  documentId: string,
  createdById: string,
  snapshot: VersionSnapshot
): Promise<DocumentVersionRecord> {
  // Compute next version number atomically via aggregation
  const agg = await prisma.documentVersion.aggregate({
    where: { documentId },
    _max: { version: true },
  })
  const nextVersion = (agg._max.version ?? 0) + 1

  const record = await prisma.documentVersion.create({
    data: {
      documentId,
      createdById,
      version: nextVersion,
      snapshot: snapshot as object,
    },
    select: {
      id: true,
      documentId: true,
      version: true,
      snapshot: true,
      createdAt: true,
      createdById: true,
    },
  })

  return {
    ...record,
    snapshot: record.snapshot as unknown as VersionSnapshot,
    createdAt: record.createdAt.toISOString(),
  }
}

export async function snapshotDocument(documentId: string): Promise<VersionSnapshot> {
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    select: {
      status: true,
      taskName: true,
      workArea: true,
      type: true,
      aiResult: true,
      validationResult: true,
      fields: {
        select: { fieldName: true, fieldValue: true, confidence: true },
        orderBy: { fieldName: 'asc' },
      },
    },
  })

  return {
    status: doc.status,
    taskName: doc.taskName,
    workArea: doc.workArea,
    type: doc.type,
    aiResult: doc.aiResult,
    validationResult: doc.validationResult,
    fields: doc.fields,
  }
}
