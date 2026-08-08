import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBusinessAccess } from '@/lib/authz'
import { addProduct, listOrders, listProducts } from '@/lib/store'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const [products, orders] = await Promise.all([listProducts(id), listOrders(id)])
  return NextResponse.json({ products, orders })
}

const productSchema = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative(),
  // null = sin control de stock (siempre disponible).
  stock: z.number().int().min(0).nullable(),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const body = await request.json()
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const product = await addProduct({ businessId: id, ...parsed.data })
  return NextResponse.json({ product })
}
