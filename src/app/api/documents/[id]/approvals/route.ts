import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { requirePermission, requireAuth, getIp } from '@/app/api/_lib/auth-middleware'
import { createApprovalFlow, getFlowForDocumentType } from '@/modules/approvals'
import type { ApprovalFlow } from '@/modules/approvals'

/**
 * GET /api/documents/[id]/approvals
 * Returns the current flow definition and all approval records for this document.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = requireAuth(req)
  if ('error' in auth) return auth.error

  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      type: true,
      status: true,
      validationResult: true,
      approvals: {
        orderBy: { approvedAt: 'asc' },
        include: { approver: { select: { name: true, role: true } } },
      },
    },
  })

  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  const storedFlow = (doc.validationResult as Record<string, unknown> | null)?.approvalFlow as
    | ApprovalFlow
    | undefined
  const flow = storedFlow ?? getFlowForDocumentType(doc.type)

  const progress = flow.steps.map((step) => {
    const approval = doc.approvals.find((a) => a.role === step.requiredRole)
    return {
      step,
      status: (approval?.status ?? 'PENDING') as string,
      approvalId: approval?.id ?? null,
      approverName: approval?.approver?.name ?? null,
      approverRole: approval?.approver?.role ?? null,
      comment: approval?.comment ?? null,
      decidedAt: approval?.approvedAt?.toISOString() ?? null,
    }
  })

  return NextResponse.json({ flow, progress, documentStatus: doc.status })
}

/**
 * POST /api/documents/[id]/approvals
 * Starts the approval flow for a document.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = requirePermission(req, 'documents:create')
  if ('error' in auth) return auth.error
  const { user } = auth

  try {
    const flow = await createApprovalFlow(id, user.uid, getIp(req))
    return NextResponse.json({ ok: true, flow }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al iniciar flujo'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
