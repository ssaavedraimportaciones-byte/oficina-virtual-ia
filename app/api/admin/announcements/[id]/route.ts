import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlatformAdmin } from '@/lib/authz'
import { deleteAnnouncement, setAnnouncementActive } from '@/lib/platform'

const schema = z.object({ active: z.boolean() })

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const { id } = await params
  const announcement = await setAnnouncementActive(id, parsed.data.active)
  if (!announcement) return NextResponse.json({ error: 'Aviso no encontrado' }, { status: 404 })
  return NextResponse.json({ announcement })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin
  const { id } = await params
  await deleteAnnouncement(id)
  return NextResponse.json({ ok: true })
}
