import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { log } from '@/modules/audit'
import { requirePermission, getIp } from '@/app/api/_lib/auth-middleware'

const createSchema = z.object({
  type: z.enum([
    'SAFETY_TALK', 'DET', 'ART', 'AST', 'WORK_PERMIT',
    'LOTO', 'HEIGHT_WORK', 'CONFINED_SPACE', 'LIFTING_PLAN',
    'EQUIPMENT_CHECKLIST', 'OTHER',
  ]),
  taskName: z.string().min(3),
  workArea: z.string().min(2),
  supervisorId: z.string().cuid().optional().or(z.literal('')),
  saveDraft: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const result = requirePermission(req, 'documents:view_own')
  if ('error' in result) return result.error

  const { user } = result
  const { searchParams } = req.nextUrl

  const where: Record<string, unknown> = {}

  if (user.role === 'WORKER') {
    where.createdById = user.uid
  } else if (!['SYSTEM_ADMIN', 'AUDITOR', 'MANAGER'].includes(user.role)) {
    where.companyId = user.companyId
  }

  const type = searchParams.get('type')
  const status = searchParams.get('status')
  if (type) where.type = type
  if (status) where.status = status

  const documents = await prisma.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      folio: true,
      type: true,
      status: true,
      taskName: true,
      workArea: true,
      companyId: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ documents })
}

export async function POST(req: NextRequest) {
  const result = requirePermission(req, 'documents:create')
  if ('error' in result) return result.error

  const { user } = result
  const body = await req.json()
  const parsed = createSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { type, taskName, workArea, supervisorId, saveDraft } = parsed.data

  const count = await prisma.document.count()
  const folio = `SC-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`
  const status = saveDraft ? 'DRAFT' : 'DRAFT'

  const document = await prisma.document.create({
    data: {
      folio,
      type,
      status,
      taskName,
      workArea,
      companyId: user.companyId,
      createdById: user.uid,
      ...(supervisorId ? { supervisorId } : {}),
    },
    select: {
      id: true,
      folio: true,
      type: true,
      status: true,
      taskName: true,
      workArea: true,
      createdAt: true,
    },
  })

  await log(
    { userId: user.uid, ip: getIp(req), userAgent: req.headers.get('user-agent') ?? '' },
    'CREATE',
    { documentId: document.id, metadata: { folio, type, taskName, saveDraft: !!saveDraft } }
  )

  return NextResponse.json({ document }, { status: 201 })
}
