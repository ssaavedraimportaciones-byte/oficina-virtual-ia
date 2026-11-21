import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlatformAdmin } from '@/lib/authz'
import { setBusinessAdminMeta } from '@/lib/platform'
import { SETUP_TIER_ORDER } from '@/lib/plans'
import { normalizeRut } from '@/lib/rut'

const schema = z.object({
  adminNotes: z.string().max(2000).optional(),
  // null = volver al límite del plan.
  replyLimitOverride: z.number().int().min(0).max(1_000_000).nullable().optional(),
  // null o vacío = sin RUT. Se valida el dígito verificador y se guarda normalizado.
  rut: z.string().max(20).nullable().optional(),
  // Nivel de la implementación del primer local (ver lib/plans.ts).
  setupTier: z.enum(SETUP_TIER_ORDER).optional(),
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
  const { rut: rawRut, ...rest } = parsed.data
  let rut: string | null | undefined
  if (rawRut !== undefined) {
    rut = rawRut === null || rawRut.trim() === '' ? null : normalizeRut(rawRut)
    if (rut === null && rawRut !== null && rawRut.trim() !== '') {
      return NextResponse.json({ error: 'El RUT no es válido: revisa el dígito verificador.' }, { status: 400 })
    }
  }
  const meta = await setBusinessAdminMeta(id, { ...rest, ...(rut !== undefined ? { rut } : {}) })
  if (!meta) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  return NextResponse.json({ ok: true, ...meta })
}
