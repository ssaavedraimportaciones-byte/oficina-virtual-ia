import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { log } from '@/modules/audit'
import { requirePermission, getIp } from '@/app/api/_lib/auth-middleware'

const patchSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  type: z.enum(['MANDANTE', 'CONTRATISTA', 'SUBCONTRATISTA']).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = requirePermission(req, 'companies:view')
  if ('error' in result) return result.error
  const { user } = result

  if (user.role !== 'SYSTEM_ADMIN' && user.companyId !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const company = await prisma.company.findUnique({
    where: { id },
    select: {
      id: true, name: true, rut: true, type: true, createdAt: true, updatedAt: true,
      _count: { select: { users: true, workers: true, documents: true } },
    },
  })

  if (!company) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

  return NextResponse.json({ company })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = requirePermission(req, 'companies:manage')
  if ('error' in result) return result.error
  const { user } = result

  // CONTRACT_ADMIN can only update their own company
  if (user.role !== 'SYSTEM_ADMIN' && user.companyId !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await prisma.company.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

  const updated = await prisma.company.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, rut: true, type: true, updatedAt: true },
  })

  await log(
    { userId: user.uid, ip: getIp(req), userAgent: req.headers.get('user-agent') ?? '' },
    'UPDATE',
    { metadata: { entity: 'company', companyId: id, changes: parsed.data } }
  )

  return NextResponse.json({ company: updated })
}
