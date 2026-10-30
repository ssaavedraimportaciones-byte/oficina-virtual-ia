import { NextResponse } from 'next/server'
import { requireBusinessAccess } from '@/lib/authz'
import { cancelReservation, getReservationBusinessId, markNoShow } from '@/lib/mesasStore'

/** Cancela la reserva: queda en el historial como cancelada. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = await getReservationBusinessId(id)
  if (!businessId) return NextResponse.json({ ok: true })
  const user = await requireBusinessAccess(businessId)
  if (user instanceof NextResponse) return user

  const reservation = await cancelReservation(id)
  return NextResponse.json({ reservation })
}

/** El cliente no llegó: libera la mesa sin borrar la reserva del historial. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = await getReservationBusinessId(id)
  if (!businessId) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
  const user = await requireBusinessAccess(businessId)
  if (user instanceof NextResponse) return user

  const body = (await request.json().catch(() => null)) as { status?: unknown } | null
  if (body?.status !== 'no_llego') {
    return NextResponse.json({ error: 'Solo se puede marcar que el cliente no llegó.' }, { status: 400 })
  }
  const reservation = await markNoShow(id)
  return NextResponse.json({ reservation })
}
