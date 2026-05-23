import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { log } from '@/modules/audit'
import { requirePermission, getIp } from '@/app/api/_lib/auth-middleware'
import { hashPassword } from '@/lib/auth'

const createSchema = z.object({
  name: z.string().min(2).max(200),
  rut: z.string().min(8).max(20),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  role: z.enum(['WORKER', 'SUPERVISOR', 'PREVENTIONIST', 'CONTRACT_ADMIN', 'MANAGER', 'AUDITOR', 'SYSTEM_ADMIN']),
  companyId: z.string().cuid(),
  password: z.string().min(8),
})

export async function GET(req: NextRequest) {
  const result = requirePermission(req, 'users:view')
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

  const roleFilter = searchParams.get('role')
  if (roleFilter) where.role = roleFilter

  const isActiveParam = searchParams.get('isActive')
  if (isActiveParam !== null) where.isActive = isActiveParam !== 'false'

  const users = await prisma.user.findMany({
    where,
    orderBy: { name: 'asc' },
    take: 100,
    select: {
      id: true, name: true, rut: true, email: true, phone: true,
      role: true, companyId: true, isActive: true, createdAt: true,
      company: { select: { name: true } },
    },
  })

  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const result = requirePermission(req, 'users:manage')
  if ('error' in result) return result.error
  const { user } = result

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // CONTRACT_ADMIN can only create users in their own company
  if (user.role !== 'SYSTEM_ADMIN' && parsed.data.companyId !== user.companyId) {
    return NextResponse.json({ error: 'No puede crear usuarios en otra empresa' }, { status: 403 })
  }

  const existsByEmail = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existsByEmail) {
    return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 })
  }

  const existsByRut = await prisma.user.findUnique({ where: { rut: parsed.data.rut } })
  if (existsByRut) {
    return NextResponse.json({ error: 'Ya existe un usuario con ese RUT' }, { status: 409 })
  }

  const { password, ...rest } = parsed.data
  const passwordHash = await hashPassword(password)

  const newUser = await prisma.user.create({
    data: { ...rest, passwordHash },
    select: {
      id: true, name: true, rut: true, email: true, phone: true,
      role: true, companyId: true, isActive: true, createdAt: true,
    },
  })

  await log(
    { userId: user.uid, ip: getIp(req), userAgent: req.headers.get('user-agent') ?? '' },
    'CREATE',
    { metadata: { entity: 'user', targetUserId: newUser.id, role: newUser.role } }
  )

  return NextResponse.json({ user: newUser }, { status: 201 })
}
