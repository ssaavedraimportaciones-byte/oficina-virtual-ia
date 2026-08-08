import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBusinessAccess } from '@/lib/authz'
import { getOrderBusinessId, setOrderStatus } from '@/lib/store'

const schema = z.object({ status: z.enum(['pendiente', 'entregado', 'cancelado']) })

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = await getOrderBusinessId(id)
  if (!businessId) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  const user = await requireBusinessAccess(businessId)
  if (user instanceof NextResponse) return user

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const order = await setOrderStatus(id, parsed.data.status)
    return NextResponse.json({ order })
  } catch {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }
}
