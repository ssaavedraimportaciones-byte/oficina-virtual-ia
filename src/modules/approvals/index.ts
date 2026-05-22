import { Prisma } from '@prisma/client'
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
export { ApprovalsError } from './errors'
import { ApprovalsError } from './errors'

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
  if (!params.comment?.trim()) throw new ApprovalsError('El rechazo requiere comentario obligatorio', 400)
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
  if (!params.comment?.trim()) throw new ApprovalsError('La observación requiere comentario obligatorio', 400)
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
  if (!params.comment.trim()) throw new ApprovalsError('El comentario no puede estar vacío', 400)

  const approval = await prisma.approval.findUnique({
    where: { id: params.approvalId },
    select: { approverId: true, documentId: true, comment: true },
  })
  if (!approval) throw new ApprovalsError('Aprobación no encontrada', 404)

  if (approval.approverId !== params.actorId && params.actorRole !== 'SYSTEM_ADMIN') {
    throw new ApprovalsError('Solo el aprobador original o SYSTEM_ADMIN puede agregar comentarios', 403)
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
// All mutable checks and writes run inside a single Serializable transaction
// so that concurrent requests cannot both pass the PENDING guard and produce
// a double decision. The AuditLog for the success path is written inside the
// same transaction (atomic with the write). Blocked events (self-approval) are
// logged outside the transaction since the transaction produces no writes for
// those cases.
//
// PostgreSQL serialization failures (P2034) are mapped to 409 — the client
// may safely retry because idempotency is handled inside the transaction.
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

  // ── Preliminary read for immutable guard checks ──────────────────────────────
  // approval.role and document.createdById are set at creation and never change —
  // safe to check before the Serializable transaction.
  const approvalPre = await prisma.approval.findUnique({
    where: { id: approvalId },
    select: {
      documentId: true,
      role: true,
      document: { select: { createdById: true } },
    },
  })
  if (!approvalPre) throw new ApprovalsError('Aprobación no encontrada', 404)

  if (approvalPre.role !== approverRole) {
    throw new ApprovalsError(
      `Este paso requiere rol "${approvalPre.role}", usted tiene "${approverRole}"`,
      403
    )
  }

  // Self-approval guard — log the blocked attempt before rejecting
  if (approvalPre.document.createdById === approverId) {
    await log(
      { userId: approverId, ip, userAgent },
      'DOCUMENT_APPROVED',
      {
        documentId: approvalPre.documentId,
        metadata: {
          approvalId,
          decision,
          before: { approvalStatus: 'PENDING', documentStatus: 'PENDING_APPROVAL' },
          after: { approvalStatus: 'PENDING', documentStatus: 'PENDING_APPROVAL' },
          blocked: true,
          idempotent: false,
          reason: 'self_approval_attempt',
          role: approverRole,
        },
      }
    ).catch(() => {})
    throw new ApprovalsError('El creador del documento no puede aprobar su propio documento', 403)
  }

  // ── Serializable transaction ─────────────────────────────────────────────────
  type TxResult = {
    documentId: string
    newDocumentStatus: string
    idempotent: boolean
    folio: string
    taskName: string
    workArea: string
    flow: ApprovalFlow | undefined
  }

  let txResult: TxResult
  try {
    txResult = await prisma.$transaction(
      async (tx) => {
        // Re-read approval inside the transaction — this is the serializable read
        const approval = await tx.approval.findUnique({
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
                createdById: true,
                approvals: {
                  select: { id: true, role: true, status: true, approverId: true },
                },
              },
            },
          },
        })

        if (!approval) throw new ApprovalsError('Aprobación no encontrada', 404)

        const beforeApprovalStatus = approval.status
        const beforeDocumentStatus = approval.document.status

        // ── Idempotency ────────────────────────────────────────────────────────
        if (approval.status !== 'PENDING') {
          if (approval.approverId === approverId && approval.status === decision) {
            // Exact repeat by the same actor — return current state without side effects
            const actionLabel =
              decision === 'APPROVED' ? 'DOCUMENT_APPROVED'
              : decision === 'REJECTED' ? 'DOCUMENT_REJECTED'
              : 'DOCUMENT_OBSERVED'
            await tx.auditLog.create({
              data: {
                userId: approverId,
                documentId: approval.documentId,
                action: actionLabel,
                metadata: {
                  approvalId,
                  decision,
                  before: { approvalStatus: beforeApprovalStatus, documentStatus: beforeDocumentStatus },
                  after: { approvalStatus: approval.status, documentStatus: approval.document.status },
                  idempotent: true,
                  blocked: false,
                },
                ipAddress: ip ?? null,
                deviceInfo: userAgent ? { userAgent } : undefined,
              },
            })
            const flow2 = (
              (approval.document.validationResult as Record<string, unknown> | null)?.approvalFlow as
                | ApprovalFlow | undefined
            )
            return {
              documentId: approval.documentId,
              newDocumentStatus: approval.document.status,
              idempotent: true,
              folio: approval.document.folio,
              taskName: approval.document.taskName,
              workArea: approval.document.workArea,
              flow: flow2,
            }
          }
          // Already decided — different actor or different decision
          throw new ApprovalsError('La aprobación ya fue procesada.', 409)
        }

        // ── Mutable guards (re-checked inside transaction) ────────────────────
        if (approval.document.status !== 'PENDING_APPROVAL') {
          throw new ApprovalsError('El documento no está en estado PENDING_APPROVAL', 422)
        }

        if (approverRole !== 'SYSTEM_ADMIN') {
          const alreadyActed = approval.document.approvals.some(
            (a) => a.approverId === approverId && a.status !== 'PENDING' && a.id !== approvalId
          )
          if (alreadyActed) {
            throw new ApprovalsError(
              'Un aprobador no puede actuar en dos pasos distintos del mismo flujo',
              403
            )
          }
        }

        // ── Write decision ─────────────────────────────────────────────────────
        await tx.approval.update({
          where: { id: approvalId },
          data: { approverId, status: decision, comment: comment ?? null, approvedAt: new Date() },
        })

        let newDocumentStatus = 'PENDING_APPROVAL'

        if (decision === 'REJECTED') {
          await tx.approval.updateMany({
            where: { documentId: approval.documentId, status: 'PENDING', id: { not: approvalId } },
            data: { status: 'REJECTED', comment: 'Cancelado por rechazo en paso anterior' },
          })
          await tx.document.update({
            where: { id: approval.documentId },
            data: { status: 'REJECTED' },
          })
          newDocumentStatus = 'REJECTED'
        } else if (decision === 'OBSERVED') {
          await tx.approval.updateMany({
            where: { documentId: approval.documentId, status: 'PENDING', id: { not: approvalId } },
            data: { status: 'REJECTED', comment: 'Cancelado por observación' },
          })
          await tx.document.update({
            where: { id: approval.documentId },
            data: { status: 'OBSERVED' },
          })
          newDocumentStatus = 'OBSERVED'
        } else {
          // APPROVED — check if all blocking steps are now done
          const remaining = await tx.approval.findMany({
            where: { documentId: approval.documentId, id: { not: approvalId } },
            select: { status: true },
          })
          const allDone = remaining.every((a) => a.status === 'APPROVED')
          if (allDone) {
            await tx.document.update({
              where: { id: approval.documentId },
              data: { status: 'APPROVED' },
            })
            newDocumentStatus = 'APPROVED'
          }
        }

        // ── AuditLog inside the same transaction ──────────────────────────────
        // Atomic with the write — if the transaction rolls back, the log rolls back too.
        const actionLabel =
          decision === 'APPROVED' ? 'DOCUMENT_APPROVED'
          : decision === 'REJECTED' ? 'DOCUMENT_REJECTED'
          : 'DOCUMENT_OBSERVED'

        await tx.auditLog.create({
          data: {
            userId: approverId,
            documentId: approval.documentId,
            action: actionLabel,
            metadata: {
              approvalId,
              decision,
              before: { approvalStatus: beforeApprovalStatus, documentStatus: beforeDocumentStatus },
              after: { approvalStatus: decision, documentStatus: newDocumentStatus },
              idempotent: false,
              blocked: false,
            },
            ipAddress: ip ?? null,
            deviceInfo: userAgent ? { userAgent } : undefined,
          },
        })

        const flow = (
          (approval.document.validationResult as Record<string, unknown> | null)?.approvalFlow as
            | ApprovalFlow | undefined
        )
        return {
          documentId: approval.documentId,
          newDocumentStatus,
          idempotent: false,
          folio: approval.document.folio,
          taskName: approval.document.taskName,
          workArea: approval.document.workArea,
          flow,
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  } catch (err) {
    if (err instanceof ApprovalsError) throw err
    // PostgreSQL serialization failure — safe to retry; treated as conflict
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
      throw new ApprovalsError('La aprobación ya fue procesada.', 409)
    }
    // Unknown error — never expose internals
    throw new ApprovalsError('Error al procesar la aprobación.', 500)
  }

  // ── Post-transaction side effects (fire-and-forget) ──────────────────────────
  const { documentId, newDocumentStatus, folio, taskName, workArea, flow } = txResult

  const allApprovals = await prisma.approval.findMany({
    where: { documentId },
    select: { role: true, status: true },
  })
  const flowComplete =
    flow !== undefined &&
    flow.steps
      .filter((s) => !s.nonBlocking)
      .every((s) => allApprovals.some((a) => a.role === s.requiredRole && a.status === 'APPROVED'))

  if (newDocumentStatus === 'APPROVED') {
    generateFinalPdf(documentId, approverId, ip).catch((err) =>
      console.error('[approvals] PDF generation failed:', err)
    )
  }

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
        documentId,
        folio,
        taskName,
        workArea,
        initiatorName: approverName,
        comment,
      },
      { excludeIds: [approverId] }
    ).catch((err) => console.error(`[notifications] ${notifEvent} failed:`, err))
  }

  return { approvalId, documentId, newDocumentStatus, flowComplete }
}
