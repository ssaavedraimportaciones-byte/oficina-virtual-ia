import { NextRequest, NextResponse } from 'next/server'
import { getProductImage } from '@/lib/store'

/**
 * Foto de un producto, pública a propósito: la piden los <img> del panel y,
 * sobre todo, Meta cuando el agente manda la foto por WhatsApp (Meta baja la
 * imagen desde un link y no tiene sesión). El id es un UUID y es la foto de un
 * plato que el negocio quiere mostrar, no un dato privado. Quién puede subirla
 * o borrarla se controla en `/api/products/[id]/image`.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const image = await getProductImage(id)
  if (!image) return new NextResponse('Sin foto', { status: 404 })

  const etag = `"${image.updatedAt.getTime()}"`
  const headers: Record<string, string> = {
    ETag: etag,
    // Con ?v= la dirección cambia cuando cambia la foto, así que puede quedar
    // guardada para siempre; sin él se revisa seguido.
    'Cache-Control': request.nextUrl.searchParams.has('v')
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=300',
    // Defensa extra por si algo no-imagen llegara a guardarse: que el
    // navegador no lo interprete ni lo ejecute.
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  }

  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers })
  }
  return new NextResponse(new Uint8Array(image.data), {
    headers: { ...headers, 'Content-Type': image.contentType },
  })
}
