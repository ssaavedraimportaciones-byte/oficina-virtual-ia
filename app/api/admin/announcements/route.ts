import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlatformAdmin } from '@/lib/authz'
import { createAnnouncement, listAnnouncements } from '@/lib/platform'

export async function GET() {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin
  return NextResponse.json({ announcements: await listAnnouncements() })
}

const schema = z.object({
  message: z.string().trim().min(1, 'El aviso no puede estar vacío').max(500),
  level: z.enum(['info', 'warning', 'maintenance']).default('info'),
})

export async function POST(request: NextRequest) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }
  return NextResponse.json({ announcement: await createAnnouncement(parsed.data) })
}
