import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPayment } from '@/lib/mercadopago'
import { confirmPayment } from '@/lib/payments'
import { decryptOptional } from '@/lib/secrets'

/**
 * Aviso de Mercado Pago de que cambió un pago. No se confía en el contenido:
 * se toma solo el id y se consulta el pago a la API con el token del negocio.
 * Recién si está aprobado, es de un pedido de ESE negocio y el monto alcanza,
 * se marca pagado. Siempre responde 200 para que Mercado Pago no reintente en
 * bucle por avisos que no nos interesan.
 */
export async function POST(request: NextRequest) {
  const url = request.nextUrl
  const businessId = url.searchParams.get('b')
  const body = (await request.json().catch(() => null)) as { type?: string; data?: { id?: string | number } } | null
  const type = body?.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic')
  const paymentId = String(body?.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? '')

  if (!businessId || type !== 'payment' || !paymentId) return NextResponse.json({ ok: true })

  try {
    const settings = await prisma.salesSettings.findUnique({ where: { businessId }, select: { mercadoPagoToken: true } })
    const token = decryptOptional(settings?.mercadoPagoToken ?? null)
    if (!token) return NextResponse.json({ ok: true })

    const payment = await getPayment(token, paymentId)
    if (!payment || payment.status !== 'approved' || !payment.orderId) return NextResponse.json({ ok: true })

    const order = await prisma.order.findFirst({ where: { id: payment.orderId, businessId }, select: { id: true, total: true } })
    if (!order || payment.amount < order.total) {
      console.error('[mercadopago] pago aprobado que no calza con un pedido del negocio', { businessId, paymentId })
      return NextResponse.json({ ok: true })
    }
    await confirmPayment(order.id, 'mercadopago')
  } catch (error) {
    // 500: que Mercado Pago reintente más tarde (la API o la base pueden estar caídas).
    console.error('[mercadopago] no se pudo procesar el aviso:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
