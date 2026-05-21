import { prisma } from '@/lib/db/client'
import { canAccess } from '@/lib/permissions'
import type { UserRole } from '@/types/user'
import type { DocumentType, DocumentStatus } from '@/types/document'

export async function crearDocumento(params: {
  type: DocumentType
  taskName: string
  workArea: string
  companyId: string
  createdById: string
  createdByRole: UserRole
  supervisorId?: string
  folio: string
}) {
  if (!canAccess(params.createdByRole, 'documents:create')) {
    throw new Error('Sin permiso para crear documentos')
  }

  return prisma.document.create({
    data: {
      folio: params.folio,
      type: params.type,
      taskName: params.taskName,
      workArea: params.workArea,
      companyId: params.companyId,
      createdById: params.createdById,
      status: 'DRAFT',
      ...(params.supervisorId ? { supervisorId: params.supervisorId } : {}),
    },
  })
}

export async function listarDocumentos(filtros: {
  companyId?: string
  createdById?: string
  type?: DocumentType
  status?: DocumentStatus
  limit?: number
}) {
  return prisma.document.findMany({
    where: {
      ...(filtros.companyId && { companyId: filtros.companyId }),
      ...(filtros.createdById && { createdById: filtros.createdById }),
      ...(filtros.type && { type: filtros.type }),
      ...(filtros.status && { status: filtros.status }),
    },
    orderBy: { createdAt: 'desc' },
    take: filtros.limit ?? 50,
    include: {
      createdBy: { select: { name: true } },
    },
  })
}

export async function cambiarEstado(params: {
  documentId: string
  newStatus: DocumentStatus
  userId: string
  userRole: UserRole
}) {
  const VALID_TRANSITIONS: Partial<Record<DocumentStatus, DocumentStatus[]>> = {
    DRAFT:             ['PENDING_SIGNATURE', 'ARCHIVED'],
    PENDING_SIGNATURE: ['PENDING_APPROVAL', 'OBSERVED'],
    PENDING_APPROVAL:  ['APPROVED', 'REJECTED', 'OBSERVED'],
    OBSERVED:          ['DRAFT'],
    APPROVED:          ['CLOSED', 'ARCHIVED'],
    REJECTED:          ['DRAFT', 'ARCHIVED'],
  }

  const doc = await prisma.document.findUnique({
    where: { id: params.documentId },
    select: { status: true },
  })
  if (!doc) throw new Error('Documento no encontrado')

  const allowed = VALID_TRANSITIONS[doc.status as DocumentStatus] ?? []
  if (!allowed.includes(params.newStatus)) {
    throw new Error(`Transición inválida: ${doc.status} → ${params.newStatus}`)
  }

  return prisma.document.update({
    where: { id: params.documentId },
    data: { status: params.newStatus },
  })
}
