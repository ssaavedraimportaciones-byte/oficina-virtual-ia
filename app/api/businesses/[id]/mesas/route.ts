import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBusinessAccess } from '@/lib/authz'
import {
  createFloor,
  getReservationSettings,
  listFloors,
  listReservations,
  setReservationSettings,
} from '@/lib/mesasStore'
import { getBusiness } from '@/lib/store'
import { businessNow } from '@/lib/timezone'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const business = await getBusiness(id)
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const now = businessNow()
  const [floors, reservations, settings] = await Promise.all([
    listFloors(id),
    listReservations(id, now.date),
    getReservationSettings(id),
  ])
  return NextResponse.json({ floors, reservations, settings, hours: business.hours, today: now.date, now: now.time })
}

const settingsSchema = z.object({
  durationMinutes: z.number().int().min(30).max(480),
  graceMinutes: z.number().int().min(0).max(120),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'La duración va de 30 a 480 minutos y la tolerancia de 0 a 120.' },
      { status: 400 },
    )
  }
  await setReservationSettings(id, parsed.data)
  return NextResponse.json({ settings: parsed.data })
}

const floorSchema = z.object({ name: z.string().trim().min(1).max(60) })

/** Crea un piso vacío. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const parsed = floorSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Ponle un nombre al piso.' }, { status: 400 })
  if ((await listFloors(id)).length >= 10) {
    return NextResponse.json({ error: 'Hasta 10 pisos por local.' }, { status: 400 })
  }
  const floor = await createFloor(id, parsed.data.name)
  return NextResponse.json({ floor })
}
