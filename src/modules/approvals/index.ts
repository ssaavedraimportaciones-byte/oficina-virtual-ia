import { prisma } from '@/lib/db/client'
import { log } from '@/modules/audit'
import { canAccess } from '@/lib/permissions'
import { getFlowForDocumentType } from './flows'
import { generateFinalPdf } from '@/modules/pdf'
import { notify } from '@/modules/notifications'
import type {
  ApprovalFlow,
  ApprovalResult,
  FlowProgress,
  PendingApprovalItem,
} from './types'
import type { UserRole } from '@/types/user'

export type { ApprovalFlow, ApprovalResult, FlowProgress, PendingApprovalItem }
export { getFlowForDocumentType }

// ── createApprovalFlow ───────────────────────────────────────────────────────
/**
 * Initialises the approval flow for a document.
 * Stores the flow definition in validationResult JSON, sets status to
 * PENDING_APPROVAL, and pre-creates PENDING Approval records for each
 * blocking step (using the creator as placeholder approverId — replaced
 * when the real approver acts).
 */
export async function createApprovalFlow(
  documentId: string,
  initiatorId: string,
  ip?: string
): Promise<ApprovalFlow> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      status: true,
      type: true,
      folio: true,
      taskName: true,
      workArea: true,
      validationResult: true,
      createdById: true,
    },
  })

  if (!doc) throw new Error('Documento no encontrado')

  const allowedPreconditions = [
    'DRAFT', 'SCANNED', 'AI_REVIEW', 'OBSERVED', 'PENDING_SIGNATURE', 'REJECTED',
  ]
  if (!allowedPreconditions.includes(doc.status)) {
    throw new Error(`No se puede iniciar flujo desde estado "${doc.status}"`)
  }

  const flow = getFlowForDocumentType(doc.type)
  const currentValidation = (doc.validationResult ?? {}) as Record<string, unknown>

  await prisma.$transaction(async (tx) => {
    await tx.approval.deleteMany({ where: { documentId, status: 'PENDING' } })

    for (const step of flow.steps.filter((s) => !s.nonBlocking)) {
      await tx.approval.create({
        data: {
          documentId,
          approverId: doc.createdById,
          role: step.requiredRole,
          status: 'PENDING',
        },
      })
    }

    await tx.document.update({
      where: { id: documentId },
      data: {
        status: 'PENDING_APPROVAL',
        validationResult: JSON.parse(JSON.stringify({ ...currentValidation, approvalFlow: flow })),
      },
    })
  })

  await log(
    { userId: initiatorId, ip },
    'APPROVAL_FLOW_STARTED',
    { documentId, metadata: { flowType: flow.flowType, steps: flow.steps.length } }
  )

  const initiator = await prisma.user.findUnique({ where: { id: initiatorId }, select: { name: true } })
  notify(
    {
      event: 'DOCUMENT_PENDING_APPROVAL',
      documentId,
      folio: doc.folio,
      taskName: doc.taskName,
      workArea: doc.workArea,
      initiatorName: initiator?.name ?? 'Usuario',
    },
    { excludeIds: [initiatorId] }
  ).catch((err) => console.error('[notifications] DOCUMENT_PENDING_APPROVAL failed:', err))

  return flow
}

// ── getPendingApprovals ──────────────────────────────────────────────────────
/**
 * Returns documents that have an unlocked pending step matching the user's role.
 * "Unlocked" means all prior blocking steps are already completed.
 */
export async function getPendingApprovals(
  userId: string,
  role: UserRole
): Promise<PendingApprovalItem[]> {
  if (!canAccess(role, 'approvals:view')) return []

  const pendingApprovals = await prisma.approval.findMany({
    where: {
      status: 'PENDING',
      role,
      document: { status: 'PENDING_APPROVAL' },
    },
    include: {
      document: {
        select: {
          id: true,
          folio: true,
          taskName: true,
          workArea: true,
          type: true,
          validationResult: true,
          createdAt: true,
          approvals: {
            select: { role: true, status: true, approverId: true },
          },
        },
      },
    },
    orderBy: { document: { createdAt: 'asc' } },
  })

  const items: PendingApprovalItem[] = []

  for (const approval of pendingApprovals) {
    const doc = approval.document
    const flow = (
      (doc.validationResult as Record<string, unknown> | null)?.approvalFlow as
        | ApprovalFlow
        | undefined
    )
    if (!flow) continue

    const step = flow.steps.find((s) => s.requiredRole === role && !s.nonBlocking)
    if (!step) continue

    // All prior blocking steps must be done
    const priorDone = flow.steps
      .filter((s) => s.order < step.order && !s.nonBlocking)
      .every((s) => {
        const rec = doc.approvals.find((a) => a.role === s.requiredRole)
        return rec && rec.status !== 'PENDING'
      })
    if (!priorDone) continue

    // Dual-role guard
    if (role !== 'SYSTEM_ADMIN') {
      const alreadyActed = doc.approvals.some(
        (a) => a.approverId === userId && a.status !== 'PENDING'
      )
      if (alreadyActed) continue
    }

    items.push({
      documentId: doc.id,
      folio: doc.folio,
      taskName: doc.taskName,
      workArea: doc.workArea,
      documentType: doc.type,
      flowStep: step,
      pendingApprovalId: approval.id,
      submittedAt: doc.createdAt.toISOString(),
    })
  }

  return items
}

// ── approveDocument ──────────────────────────────────────────────────────────
export async function approveDocument(params: {
  approvalId: string
  approverId: string
  approverRole: UserRole
  comment?: string
  ip?: string
  userAgent?: string
}): Promise<ApprovalResult> {
  return _recordDecision({ ...params, decision: 'APPROVED' })
}

// ── rejectDocument ───────────────────────────────────────────────────────────
export async function rejectDocument(params: {
  approvalId: string
  approverId: string
  approverRole: UserRole
  comment: string
  ip?: string
  userAgent?: string
}): Promise<ApprovalResult> {
  if (!params.comment?.trim()) throw new Error('El rechazo requiere comentario obligatorio')
  return _recordDecision({ ...params, decision: 'REJECTED' })
}

// ── observeDocument ──────────────────────────────────────────────────────────
export async function observeDocument(params: {
  approvalId: string
  approverId: string
  approverRole: UserRole
  comment: string
  ip?: string
  userAgent?: string
}): Promise<ApprovalResult> {
  if (!params.comment?.trim()) throw new Error('La observación requiere comentario obligatorio')
  return _recordDecision({ ...params, decision: 'OBSERVED' })
}

// ── addApprovalComment ───────────────────────────────────────────────────────
/**
 * Appends a timestamped comment to an existing approval record without
 * changing its status. Only the original approver or SYSTEM_ADMIN may do this.
 */
export async function addApprovalComment(params: {
  approvalId: string
  actorId: string
  actorRole: UserRole
  comment: string
  ip?: string
}): Promise<void> {
  if (!params.comment.trim()) throw new Error('El comentario no puede estar vacío')

  const approval = await prisma.approval.findUnique({
    where: { id: params.approvalId },
    select: { approverId: true, documentId: true, comment: true },
  })
  if (!approval) throw new Error('Aprobación no encontrada')

  if (approval.approverId !== params.actorId && params.actorRole !== 'SYSTEM_ADMIN') {
    throw new Error('Solo el aprobador original o SYSTEM_ADMIN puede agregar comentarios')
  }

  const separator = approval.comment ? '\n---\n' : ''
  const timestamp = new Date().toISOString()

  await prisma.approval.update({
    where: { id: params.approvalId },
    data: { comment: `${approval.comment ?? ''}${separator}[${timestamp}] ${params.comment}` },
  })

  await log(
    { userId: params.actorId, ip: params.ip },
    'APPROVAL_COMMENT',
    { documentId: approval.documentId, metadata: { approvalId: params.approvalId } }
  )
}

// ── _recordDecision ───────────────────────────────────────────────────────────
async function _recordDecision(params: {
  approvalId: string
  approverId: string
  approverRole: UserRole
  decision: 'APPROVED' | 'REJECTED' | 'OBSERVED'
  comment?: string
  ip?: string
  userAgent?: string
}): Promise<ApprovalResult> {
  const { approvalId, approverId, approverRole, decision, comment, ip, userAgent } = params

  const approval = await prisma.approval.findUnique({
    where: { id: approvalId },
    include: {
      document: {
        select: {
          id: true,
          status: true,
          type: true,
          folio: true,
          taskName: true,
          workArea: true,
          validationResult: true,
          approvals: {
            select: { id: true, role: true, status: true, approverId: true },
          },
        },
      },
    },
  })

  if (!approval) throw new Error('Aprobación no encontrada')
  if (approval.status !== 'PENDING') {
    throw new Error(`Esta aprobación ya fue procesada (estado: ${approval.status})`)
  }
  if (approval.document.status !== 'PENDING_APPROVAL') {
    throw new Error('El documento no está en estado PENDING_APPROVAL')
  }
  if (approval.role !== approverRole) {
    throw new Error(`Este paso requiere rol "${approval.role}", usted tiene "${approverRole}"`)
  }

  // Dual-role guard
  if (approverRole !== 'SYSTEM_ADMIN') {
    const alreadyActed = approval.document.approvals.some(
      (a) => a.approverId === approverId && a.status !== 'PENDING' && a.id !== approvalId
    )
    if (alreadyActed) {
      throw new Error('Un aprobador no puede actuar en dos pasos distintos del mismo flujo')
    }
  }

  const flow = (
    (approval.document.validationResult as Record<string, unknown> | null)?.approvalFlow as
      | ApprovalFlow
      | undefined
  )

  const newDocumentStatus = await prisma.$transaction(async (tx) => {
    await tx.approval.update({
      where: { id: approvalId },
      data: { approverId, status: decision, comment: comment ?? null, approvedAt: new Date() },
    })

    if (decision === 'REJECTED') {
      await tx.approval.updateMany({
        where: { documentId: approval.documentId, status: 'PENDING', id: { not: approvalId } },
        data: { status: 'REJECTED', comment: 'Cancelado por rechazo en paso anterior' },
      })
      await tx.document.update({
        where: { id: approval.documentId },
        data: { status: 'REJECTED' },
      })
      return 'REJECTED'
    }

    if (decision === 'OBSERVED') {
      await tx.approval.updateMany({
        where: { documentId: approval.documentId, status: 'PENDING', id: { not: approvalId } },
        data: { status: 'REJECTED', comment: 'Cancelado por observación' },
      })
      await tx.document.update({
        where: { id: approval.documentId },
        data: { status: 'OBSERVED' },
      })
      return 'OBSERVED'
    }

    // APPROVED — check if all blocking steps are now done
    const remaining = await tx.approval.findMany({
      where: { documentId: approval.documentId, id: { not: approvalId } },
      select: { status: true },
    })
    const allDone = remaining.every((a) => a.status === 'APPROVED')

    if (allDone) {
      await tx.document.update({ where: { id: approval.documentId }, data: { status: 'APPROVED' } })
      return 'APPROVED'
    }

    return 'PENDING_APPROVAL'
  })

  const actionLabel =
    decision === 'APPROVED' ? 'DOCUMENT_APPROVED'
    : decision === 'REJECTED' ? 'DOCUMENT_REJECTED'
    : 'DOCUMENT_OBSERVED'

  await log(
    { userId: approverId, ip, userAgent },
    actionLabel,
    { documentId: approval.documentId, metadata: { approvalId, role: approverRole, decision } }
  )

  const allApprovals = await prisma.approval.findMany({
    where: { documentId: approval.documentId },
    select: { role: true, status: true },
  })
  const flowComplete =
    flow !== undefined &&
    flow.steps
      .filter((s) => !s.nonBlocking)
      .every((s) => allApprovals.some((a) => a.role === s.requiredRole && a.status === 'APPROVED'))

  // Auto-generate final PDF when document reaches APPROVED
  if (newDocumentStatus === 'APPROVED') {
    generateFinalPdf(approval.documentId, approverId, ip).catch((err) =>
      console.error('[approvals] PDF generation failed:', err)
    )
  }

  // Send notifications — fire-and-forget, never blocks approval
  const approver = await prisma.user.findUnique({ where: { id: approverId }, select: { name: true } })
  const approverName = approver?.name ?? 'Aprobador'
  const notifEvent =
    newDocumentStatus === 'APPROVED' ? 'DOCUMENT_APPROVED'
    : newDocumentStatus === 'REJECTED' ? 'DOCUMENT_REJECTED'
    : newDocumentStatus === 'OBSERVED' ? 'DOCUMENT_OBSERVED'
    : null

  if (notifEvent) {
    notify(
      {
        event: notifEvent,
        documentId: approval.documentId,
        folio: approval.document.folio,
        taskName: approval.document.taskName,
        workArea: approval.document.workArea,
        initiatorName: approverName,
        comment,
      },
      { excludeIds: [approverId] }
    ).catch((err) => console.error(`[notifications] ${notifEvent} failed:`, err))
  }

  return { approvalId, documentId: approval.documentId, newDocumentStatus, flowComplete }
}
