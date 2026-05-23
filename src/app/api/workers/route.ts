import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { log } from '@/modules/audit'
import { requirePermission, getIp } from '@/app/api/_lib/auth-middleware'

const createSchema = z.object({
  name: z.string().min(2).max(200),
  rut: z.string().min(8).max(20),
  companyId: z.string().cuid(),
  position: z.string().min(2).max(200),
  certifications: z.array(z.string().max(100)).max(50).optional().default([]),
})

export async function GET(req: NextRequest) {
  const result = requirePermission(req, 'workers:view')
  if ('error' in result) return result.error
  const { user } = result

  const { searchParams } = req.nextUrl
  const companyFilter = searchParams.get('companyId')

  const where: Record<string, unknown> = {}

  if (user.role !== 'SYSTEM_ADMIN') {
    where.companyId = user.companyId
  } else if (companyFilter) {
    where.companyId = companyFilter
  }

  const isActiveParam = searchParams.get('isActive')
  if (isActiveParam !== null) where.isActive = isActiveParam !== 'false'

  const workers = await prisma.worker.findMany({
    where,
    orderBy: { name: 'asc' },
    take: 200,
    select: {
      id: true, name: true, rut: true, companyId: true,
      position: true, certifications: true, isActive: true, createdAt: true,
      company: { select: { name: true } },
    },
  })

  return NextResponse.json({ workers })
}

export async function POST(req: NextRequest) {
  const result = requirePermission(req, 'workers:manage')
  if ('error' in result) return result.error
  const { user } = result

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (user.role !== 'SYSTEM_ADMIN' && parsed.data.companyId !== user.companyId) {
    return NextResponse.json({ error: 'No puede crear trabajadores en otra empresa' }, { status: 403 })
  }

  const exists = await prisma.worker.findUnique({ where: { rut: parsed.data.rut } })
  if (exists) {
    return NextResponse.json({ error: 'Ya existe un trabajador con ese RUT' }, { status: 409 })
  }

  const worker = await prisma.worker.create({
    data: parsed.data,
    select: {
      id: true, name: true, rut: true, companyId: true,
      position: true, certifications: true, isActive: true, createdAt: true,
    },
  })

  await log(
    { userId: user.uid, ip: getIp(req), userAgent: req.headers.get('user-agent') ?? '' },
    'CREATE',
    { metadata: { entity: 'worker', workerId: worker.id, companyId: worker.companyId } }
  )

  return NextResponse.json({ worker }, { status: 201 })
}
