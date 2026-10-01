import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { deleteUser } from '@/lib/auth'
import { requirePlatformAdmin } from '@/lib/authz'
import { setUserPlan } from '@/lib/platform'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = await params
  if (id === admin.id) {
    return NextResponse.json({ error: 'No puedes eliminar tu propio usuario.' }, { status: 400 })
  }

  await deleteUser(id)
  return NextResponse.json({ ok: true })
}

const planSchema = z.object({ plan: z.enum(['FREE', 'PRO']) })

/**
 * Cambia el plan a mano: dar PRO de cortesía (sin Stripe) o quitarlo. Ojo que
 * una cancelación o un pago fallido en Stripe también cambia el plan de quien
 * tiene suscripción; la cortesía no depende de Stripe.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin

  const parsed = planSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'El plan tiene que ser FREE o PRO' }, { status: 400 })
  }

  const { id } = await params
  if (!(await setUserPlan(id, parsed.data.plan))) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, plan: parsed.data.plan })
}
