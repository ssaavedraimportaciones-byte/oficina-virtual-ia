import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { log } from '@/modules/audit'
import { requirePermission, getIp } from '@/app/api/_lib/auth-middleware'

const createSchema = z.object({
  name: z.string().min(2).max(200),
  rut: z.string().min(8).max(20),
  type: z.enum(['MANDANTE', 'CONTRATISTA', 'SUBCONTRATISTA']),
})

export async function GET(req: NextRequest) {
  const result = requirePermission(req, 'companies:view')
  if ('error' in result) return result.error
  const { user } = result

  // CONTRACT_ADMIN only sees their own company
  const where =
    user.role === 'SYSTEM_ADMIN' ? {} : { id: user.companyId }

  const companies = await prisma.company.findMany({
    where,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      rut: true,
      type: true,
      createdAt: true,
      _count: { select: { users: true, workers: true, documents: true } },
    },
  })

  return NextResponse.json({ companies })
}

export async function POST(req: NextRequest) {
  const result = requirePermission(req, 'companies:manage')
  if ('error' in result) return result.error
  const { user } = result

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const exists = await prisma.company.findUnique({ where: { rut: parsed.data.rut } })
  if (exists) {
    return NextResponse.json({ error: 'Ya existe una empresa con ese RUT' }, { status: 409 })
  }

  const company = await prisma.company.create({
    data: parsed.data,
    select: { id: true, name: true, rut: true, type: true, createdAt: true },
  })

  await log(
    { userId: user.uid, ip: getIp(req), userAgent: req.headers.get('user-agent') ?? '' },
    'CREATE',
    { metadata: { entity: 'company', companyId: company.id, name: company.name } }
  )

  return NextResponse.json({ company }, { status: 201 })
}
