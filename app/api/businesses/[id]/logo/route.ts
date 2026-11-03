import { NextRequest, NextResponse } from 'next/server'
import { requireBusinessAccess } from '@/lib/authz'
import { checkImage, MAX_IMAGE_BYTES } from '@/lib/productImage'
import { deleteBusinessLogo, getBusiness, setBusinessLogo } from '@/lib/store'

// Sube o reemplaza el logo del negocio (multipart, campo "file"). Mismo
// patrón que /api/products/[id]/image.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  if (!(await getBusiness(id))) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta la imagen.' }, { status: 400 })
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'La imagen pesa demasiado (máximo 1 MB).' }, { status: 413 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const check = checkImage(bytes)
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 })

  const logoVersion = await setBusinessLogo(id, { contentType: check.type, data: Buffer.from(bytes) })
  return NextResponse.json({ logoVersion })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  await deleteBusinessLogo(id)
  return NextResponse.json({ ok: true })
}
