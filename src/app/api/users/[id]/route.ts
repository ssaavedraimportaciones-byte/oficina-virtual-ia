import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { log } from '@/modules/audit'
import { requirePermission, requireAuth, getIp } from '@/app/api/_lib/auth-middleware'
import { hashPassword } from '@/lib/auth'

const patchSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  phone: z.string().max(20).optional(),
  role: z.enum(['WORKER', 'SUPERVISOR', 'PREVENTIONIST', 'CONTRACT_ADMIN', 'MANAGER', 'AUDITOR', 'SYSTEM_ADMIN']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = requireAuth(req)
  if ('error' in result) return result.error
  const { user } = result

  // Any authenticated user can view their own profile
  const isSelf = user.uid === id
  if (!isSelf) {
    const viewResult = requirePermission(req, 'users:view')
    if ('error' in viewResult) return viewResult.error
    if (user.role !== 'SYSTEM_ADMIN') {
      const target = await prisma.user.findUnique({ where: { id }, select: { companyId: true } })
      if (!target || target.companyId !== user.companyId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
  }

  const found = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, rut: true, email: true, phone: true,
      role: true, companyId: true, isActive: true, createdAt: true, updatedAt: true,
      company: { select: { name: true, type: true } },
    },
  })

  if (!found) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  return NextResponse.json({ user: found })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = requirePermission(req, 'users:manage')
  if ('error' in result) return result.error
  const { user } = result

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, companyId: true, role: true } })
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  if (user.role !== 'SYSTEM_ADMIN' && target.companyId !== user.companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Only SYSTEM_ADMIN can assign SYSTEM_ADMIN role
  if (parsed.data.role === 'SYSTEM_ADMIN' && user.role !== 'SYSTEM_ADMIN') {
    return NextResponse.json({ error: 'No autorizado para asignar ese rol' }, { status: 403 })
  }

  const { password, ...rest } = parsed.data
  const data: Record<string, unknown> = { ...rest }
  if (password) data.passwordHash = await hashPassword(password)

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true, name: true, email: true, phone: true,
      role: true, companyId: true, isActive: true, updatedAt: true,
    },
  })

  await log(
    { userId: user.uid, ip: getIp(req), userAgent: req.headers.get('user-agent') ?? '' },
    'UPDATE',
    { metadata: { entity: 'user', targetUserId: id, changes: Object.keys(rest) } }
  )

  return NextResponse.json({ user: updated })
}
