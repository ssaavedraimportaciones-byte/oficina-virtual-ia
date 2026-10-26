import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlatformAdmin } from '@/lib/authz'
import { deleteIntake, updateIntake } from '@/lib/intakeStore'

const schema = z.object({
  steps: z.array(z.string()).max(50).optional(),
  notes: z.string().trim().max(2000).optional(),
  businessId: z.string().trim().max(100).nullable().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const { id } = await params
  const intake = await updateIntake(id, parsed.data)
  if (!intake) return NextResponse.json({ error: 'Alta no encontrada' }, { status: 404 })
  return NextResponse.json({ intake })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin
  const { id } = await params
  await deleteIntake(id)
  return NextResponse.json({ ok: true })
}
