import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBusinessAccess } from '@/lib/authz'
import { reservableTables } from '@/lib/mesas'
import { getReservationMinutes, listFloors, reserveTable } from '@/lib/mesasStore'
import { getBusiness } from '@/lib/store'

const reservationSchema = z.object({
  tableId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  partySize: z.number().int().min(1).max(100),
  contactName: z.string().trim().min(1).max(80),
  contactHandle: z.string().trim().max(40).default(''),
  note: z.string().trim().max(300).default(''),
})

/** Reserva anotada a mano por el local (por teléfono, en persona). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const parsed = reservationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Revisa los datos de la reserva.' }, { status: 400 })

  const business = await getBusiness(id)
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  // La mesa se busca entre las de ESTE negocio: un tableId ajeno no aparece.
  const option = reservableTables(await listFloors(id)).find((o) => o.table.id === parsed.data.tableId)
  if (!option) return NextResponse.json({ error: 'Esa mesa no existe o no se puede reservar.' }, { status: 400 })

  const result = await reserveTable({
    businessId: id,
    hours: business.hours,
    option,
    date: parsed.data.date,
    time: parsed.data.time,
    partySize: parsed.data.partySize,
    durationMinutes: await getReservationMinutes(id),
    contactName: parsed.data.contactName,
    contactHandle: parsed.data.contactHandle,
    conversationId: null,
    note: parsed.data.note,
    enforceHours: false,
  })
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 409 })
  return NextResponse.json({ reservation: result.reservation })
}
