import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { log } from '@/modules/audit'
import { requirePermission, getIp } from '@/app/api/_lib/auth-middleware'

const patchSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  position: z.string().min(2).max(200).optional(),
  certifications: z.array(z.string().max(100)).max(50).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = requirePermission(req, 'workers:view')
  if ('error' in result) return result.error
  const { user } = result

  const worker = await prisma.worker.findUnique({
    where: { id },
    select: {
      id: true, name: true, rut: true, companyId: true,
      position: true, certifications: true, isActive: true, createdAt: true, updatedAt: true,
      company: { select: { name: true, type: true } },
    },
  })

  if (!worker) return NextResponse.json({ error: 'Trabajador no encontrado' }, { status: 404 })

  if (user.role !== 'SYSTEM_ADMIN' && worker.companyId !== user.companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ worker })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = requirePermission(req, 'workers:manage')
  if ('error' in result) return result.error
  const { user } = result

  const worker = await prisma.worker.findUnique({ where: { id }, select: { id: true, companyId: true } })
  if (!worker) return NextResponse.json({ error: 'Trabajador no encontrado' }, { status: 404 })

  if (user.role !== 'SYSTEM_ADMIN' && worker.companyId !== user.companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await prisma.worker.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true, name: true, rut: true, companyId: true,
      position: true, certifications: true, isActive: true, updatedAt: true,
    },
  })

  await log(
    { userId: user.uid, ip: getIp(req), userAgent: req.headers.get('user-agent') ?? '' },
    'UPDATE',
    { metadata: { entity: 'worker', workerId: id, changes: parsed.data } }
  )

  return NextResponse.json({ worker: updated })
}
