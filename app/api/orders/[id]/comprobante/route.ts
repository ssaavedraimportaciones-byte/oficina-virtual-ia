import { NextResponse } from 'next/server'
import { requireBusinessAccess } from '@/lib/authz'
import { prisma } from '@/lib/db'
import { getOrderBusinessId } from '@/lib/store'

/** La imagen del comprobante que mandó el cliente. Solo la ve gente del negocio. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = await getOrderBusinessId(id)
  if (!businessId) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const user = await requireBusinessAccess(businessId)
  if (user instanceof NextResponse) return user

  const receipt = await prisma.orderReceipt.findUnique({ where: { orderId: id } })
  if (!receipt) return NextResponse.json({ error: 'Este pedido no tiene comprobante' }, { status: 404 })
  return new NextResponse(new Uint8Array(receipt.data), {
    headers: {
      'Content-Type': receipt.contentType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
