import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlatformAdmin } from '@/lib/authz'
import { setBusinessAdminMeta } from '@/lib/platform'

const schema = z.object({
  adminNotes: z.string().max(2000).optional(),
  // null = volver al límite del plan.
  replyLimitOverride: z.number().int().min(0).max(1_000_000).nullable().optional(),
})

/** Notas internas y límite mensual de respuestas de una empresa. Solo administradores de plataforma. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { id } = await params
  const meta = await setBusinessAdminMeta(id, parsed.data)
  if (!meta) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  return NextResponse.json({ ok: true, ...meta })
}
