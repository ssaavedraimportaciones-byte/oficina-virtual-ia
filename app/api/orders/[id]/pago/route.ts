import { NextResponse } from 'next/server'
import { requireBusinessAccess } from '@/lib/authz'
import { confirmPayment } from '@/lib/payments'
import { getOrderBusinessId } from '@/lib/store'

/**
 * El local vio la transferencia en su cuenta y la confirma: el pedido pasa a
 * cocina y el agente le avisa al cliente. Solo una persona del negocio puede.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = await getOrderBusinessId(id)
  if (!businessId) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

  const user = await requireBusinessAccess(businessId)
  if (user instanceof NextResponse) return user

  const order = await confirmPayment(id, 'transferencia')
  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  return NextResponse.json({ order })
}
