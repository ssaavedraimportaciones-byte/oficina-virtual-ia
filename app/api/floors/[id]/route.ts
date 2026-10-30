import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBusinessAccess } from '@/lib/authz'
import { CANVAS, ELEMENT_KINDS, SUN_SIDES } from '@/lib/mesas'
import { deleteFloor, getFloorBusinessId, saveFloorLayout } from '@/lib/mesasStore'

const coord = z.number().int().min(-CANVAS.maxSize).max(CANVAS.maxSize * 2)
const size = z.number().int().min(4).max(CANVAS.maxSize)

const elementSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(ELEMENT_KINDS),
  label: z.string().trim().max(40),
  x: coord,
  y: coord,
  width: size,
  height: size,
  shape: z.enum(['rect', 'round']),
  seats: z.number().int().min(0).max(40),
  sun: z.enum(SUN_SIDES).nullable(),
  zone: z.string().trim().max(40),
  nearWindow: z.boolean().nullable(),
  reservable: z.boolean(),
})

const layoutSchema = z.object({
  name: z.string().trim().min(1).max(60),
  width: z.number().int().min(CANVAS.minSize).max(CANVAS.maxSize),
  height: z.number().int().min(CANVAS.minSize).max(CANVAS.maxSize),
  elements: z.array(elementSchema).max(CANVAS.maxElements),
})

/** Guarda el croquis entero del piso. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = await getFloorBusinessId(id)
  if (!businessId) return NextResponse.json({ error: 'Piso no encontrado' }, { status: 404 })
  const user = await requireBusinessAccess(businessId)
  if (user instanceof NextResponse) return user

  const parsed = layoutSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'El croquis tiene datos que no se pueden guardar.' }, { status: 400 })
  }

  const unnamed = parsed.data.elements.find((e) => e.kind === 'mesa' && !e.label)
  if (unnamed) return NextResponse.json({ error: 'Todas las mesas necesitan un nombre.' }, { status: 400 })

  const result = await saveFloorLayout(id, parsed.data)
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 })
  return NextResponse.json({ floor: result.floor })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = await getFloorBusinessId(id)
  if (!businessId) return NextResponse.json({ ok: true })
  const user = await requireBusinessAccess(businessId)
  if (user instanceof NextResponse) return user

  await deleteFloor(id)
  return NextResponse.json({ ok: true })
}
