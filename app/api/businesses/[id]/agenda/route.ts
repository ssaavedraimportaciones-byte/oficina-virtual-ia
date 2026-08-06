import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  addService,
  getBusiness,
  listAppointments,
  listServices,
  updateBusinessHours,
} from '@/lib/store'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const business = await getBusiness(id)
  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const [services, appointments] = await Promise.all([listServices(id), listAppointments(id)])
  return NextResponse.json({ hours: business.hours, services, appointments })
}

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

const hoursSchema = z.object({
  hours: z
    .array(z.object({ open: z.string().regex(timeRegex), close: z.string().regex(timeRegex) }).nullable())
    .length(7),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const parsed = hoursSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const invalid = parsed.data.hours.find((day) => day && day.open >= day.close)
  if (invalid) {
    return NextResponse.json(
      { error: 'La hora de cierre tiene que ser posterior a la de apertura' },
      { status: 400 },
    )
  }

  if (!(await getBusiness(id))) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const business = await updateBusinessHours(id, parsed.data.hours)
  return NextResponse.json({ hours: business.hours })
}

const serviceSchema = z.object({
  name: z.string().min(1),
  durationMinutes: z.number().int().min(5).max(600),
  price: z.string().min(1),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const parsed = serviceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (!(await getBusiness(id))) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const service = await addService({ businessId: id, ...parsed.data })
  return NextResponse.json({ service })
}
