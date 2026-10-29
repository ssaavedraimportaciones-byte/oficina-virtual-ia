import { NextRequest, NextResponse } from 'next/server'
import { requireBusinessAccess } from '@/lib/authz'
import { checkImage, MAX_IMAGE_BYTES } from '@/lib/productImage'
import { deleteProductImage, getProductBusinessId, setProductImage } from '@/lib/store'

// Sube o reemplaza la foto de un producto (multipart, campo "file").
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = await getProductBusinessId(id)
  if (!businessId) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

  const user = await requireBusinessAccess(businessId)
  if (user instanceof NextResponse) return user

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta la imagen.' }, { status: 400 })
  }
  // Se mira el tamaño antes de leer el archivo entero a memoria.
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'La imagen pesa demasiado (máximo 1 MB).' }, { status: 413 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const check = checkImage(bytes)
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 })

  const imageVersion = await setProductImage(id, { contentType: check.type, data: Buffer.from(bytes) })
  return NextResponse.json({ imageVersion })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = await getProductBusinessId(id)
  if (!businessId) return NextResponse.json({ ok: true })

  const user = await requireBusinessAccess(businessId)
  if (user instanceof NextResponse) return user

  await deleteProductImage(id)
  return NextResponse.json({ ok: true })
}
