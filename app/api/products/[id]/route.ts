import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { deleteProduct, updateProduct } from '@/lib/store'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().nonnegative().optional(),
  stock: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const product = await updateProduct(id, parsed.data)
    return NextResponse.json({ product })
  } catch {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteProduct(id)
  return NextResponse.json({ ok: true })
}
