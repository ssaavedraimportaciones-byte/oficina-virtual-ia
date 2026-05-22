import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, getIp } from '@/app/api/_lib/auth-middleware'
import {
  approveDocument,
  rejectDocument,
  observeDocument,
  addApprovalComment,
  ApprovalsError,
} from '@/modules/approvals'

interface Params {
  params: { id: string; approvalId: string }
}

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'observe', 'comment']),
  comment: z.string().optional(),
})

/**
 * POST /api/documents/[id]/approvals/[approvalId]
 * Actions: approve | reject | observe | comment
 */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = requirePermission(req, 'approvals:manage')
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })

  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { action, comment } = parsed.data
  const ip = getIp(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  try {
    if (action === 'approve') {
      const result = await approveDocument({
        approvalId: params.approvalId,
        approverId: user.uid,
        approverRole: user.role,
        comment,
        ip,
        userAgent,
      })
      return NextResponse.json({ ok: true, result })
    }

    if (action === 'reject') {
      if (!comment?.trim()) {
        return NextResponse.json({ error: 'El rechazo requiere comentario' }, { status: 400 })
      }
      const result = await rejectDocument({
        approvalId: params.approvalId,
        approverId: user.uid,
        approverRole: user.role,
        comment,
        ip,
        userAgent,
      })
      return NextResponse.json({ ok: true, result })
    }

    if (action === 'observe') {
      if (!comment?.trim()) {
        return NextResponse.json({ error: 'La observación requiere comentario' }, { status: 400 })
      }
      const result = await observeDocument({
        approvalId: params.approvalId,
        approverId: user.uid,
        approverRole: user.role,
        comment,
        ip,
        userAgent,
      })
      return NextResponse.json({ ok: true, result })
    }

    // comment
    if (!comment?.trim()) {
      return NextResponse.json({ error: 'El comentario no puede estar vacío' }, { status: 400 })
    }
    await addApprovalComment({
      approvalId: params.approvalId,
      actorId: user.uid,
      actorRole: user.role,
      comment,
      ip,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ApprovalsError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Error al procesar la acción.' }, { status: 500 })
  }
}
