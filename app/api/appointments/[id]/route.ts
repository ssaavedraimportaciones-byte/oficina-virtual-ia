import { NextResponse } from 'next/server'
import { requireBusinessAccess } from '@/lib/authz'
import { cancelAppointment, getAppointmentBusinessId } from '@/lib/store'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = await getAppointmentBusinessId(id)
  if (!businessId) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  }

  const user = await requireBusinessAccess(businessId)
  if (user instanceof NextResponse) return user

  try {
    const appointment = await cancelAppointment(id)
    return NextResponse.json({ appointment })
  } catch {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  }
}
