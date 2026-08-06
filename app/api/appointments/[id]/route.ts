import { NextResponse } from 'next/server'
import { cancelAppointment } from '@/lib/store'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const appointment = await cancelAppointment(id)
    return NextResponse.json({ appointment })
  } catch {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  }
}
