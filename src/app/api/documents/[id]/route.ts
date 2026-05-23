import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { log } from '@/modules/audit'
import { requirePermission, requireAuth, getIp } from '@/app/api/_lib/auth-middleware'
import { createDocumentVersion, snapshotDocument } from '@/modules/documents/version'

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT:             ['PENDING_SIGNATURE', 'ARCHIVED'],
  PENDING_SIGNATURE: ['PENDING_APPROVAL', 'OBSERVED'],
  PENDING_APPROVAL:  ['APPROVED', 'REJECTED', 'OBSERVED'],
  OBSERVED:          ['DRAFT'],
  APPROVED:          ['CLOSED', 'ARCHIVED'],
  REJECTED:          ['DRAFT', 'ARCHIVED'],
}

const patchSchema = z.object({
  status: z.string().optional(),
  taskName: z.string().min(3).optional(),
  workArea: z.string().min(2).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = requireAuth(req)
  if ('error' in result) return result.error

  const { user } = result

  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true, role: true } },
      supervisor: { select: { name: true } },
      fields: true,
      auditLogs: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { name: true, role: true } } },
        take: 100,
      },
    },
  })

  if (!doc) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  if (
    user.role === 'WORKER' &&
    doc.createdById !== user.uid
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await log(
    { userId: user.uid, ip: getIp(req), userAgent: req.headers.get('user-agent') ?? '' },
    'DOCUMENT_READ',
    { documentId: doc.id, metadata: { folio: doc.folio } }
  )

  return NextResponse.json({ document: doc })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = requireAuth(req)
  if ('error' in result) return result.error

  const { user } = result
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, status: true, folio: true, createdById: true, companyId: true, taskName: true, workArea: true },
  })

  if (!doc) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  if (user.role === 'WORKER' && doc.createdById !== user.uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const LOCKED_STATUSES = ['APPROVED', 'CLOSED', 'ARCHIVED']
  if (LOCKED_STATUSES.includes(doc.status) && (parsed.data.taskName || parsed.data.workArea)) {
    return NextResponse.json(
      { error: `No se pueden modificar campos de un documento en estado "${doc.status}"` },
      { status: 422 }
    )
  }

  const updates: Record<string, unknown> = {}
  const meta: Record<string, unknown> = {}

  if (parsed.data.status) {
    const allowed = VALID_TRANSITIONS[doc.status] ?? []
    if (!allowed.includes(parsed.data.status)) {
      return NextResponse.json(
        { error: `Transición inválida: ${doc.status} → ${parsed.data.status}` },
        { status: 422 }
      )
    }
    updates.status = parsed.data.status
    meta.previousStatus = doc.status
    meta.newStatus = parsed.data.status
  }

  if (parsed.data.taskName) {
    meta.previousTaskName = doc.taskName
    updates.taskName = parsed.data.taskName
  }
  if (parsed.data.workArea) {
    meta.previousWorkArea = doc.workArea
    updates.workArea = parsed.data.workArea
  }

  const updated = await prisma.document.update({
    where: { id },
    data: updates,
    select: { id: true, folio: true, status: true, updatedAt: true },
  })

  let action: import('@/modules/audit').AuditAction = 'DOCUMENT_EDITED'
  if (parsed.data.status === 'CLOSED')    action = 'DOCUMENT_CLOSED'
  else if (parsed.data.status === 'ARCHIVED')  action = 'DOCUMENT_ARCHIVED'
  else if (parsed.data.status === 'APPROVED')  action = 'DOCUMENT_APPROVED'
  else if (parsed.data.status === 'REJECTED')  action = 'DOCUMENT_REJECTED'
  else if (parsed.data.status === 'OBSERVED')  action = 'DOCUMENT_OBSERVED'
  else if (parsed.data.status)                 action = 'DOCUMENT_EDITED'

  await log(
    { userId: user.uid, ip: getIp(req), userAgent: req.headers.get('user-agent') ?? '' },
    action,
    { documentId: doc.id, metadata: { folio: doc.folio, ...meta } }
  )

  // Snapshot inmutable en cada transición de estado
  if (parsed.data.status) {
    const snapshot = await snapshotDocument(id)
    await createDocumentVersion(id, user.uid, snapshot).catch((err) => {
      console.error('[document-version] Failed to create version:', err)
    })
  }

  return NextResponse.json({ document: updated })
}
