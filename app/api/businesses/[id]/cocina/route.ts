import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBusinessAccess } from '@/lib/authz'
import { listKitchenOrders, markKitchenPrinted } from '@/lib/payments'

export const dynamic = 'force-dynamic'

/** Cola de cocina: pedidos listos para preparar (pagados, o sin cobro previo). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user
  return NextResponse.json({ orders: await listKitchenOrders(id) })
}

const schema = z.object({ orderId: z.string().min(1) })

/** Marca un ticket como impreso, para que no salga dos veces. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Falta el pedido.' }, { status: 400 })
  return NextResponse.json({ printed: await markKitchenPrinted(id, parsed.data.orderId) })
}
