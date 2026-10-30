import { NextResponse } from 'next/server'
import { requireBusinessAccess } from '@/lib/authz'
import { cancelReservation, getReservationBusinessId } from '@/lib/mesasStore'

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
