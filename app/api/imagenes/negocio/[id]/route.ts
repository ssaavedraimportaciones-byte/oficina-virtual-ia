import { NextRequest, NextResponse } from 'next/server'
import { getBusinessLogo } from '@/lib/store'

/**
 * Logo de un negocio, público a propósito: lo pide el <img> del panel (menú
 * lateral, lista de negocios) y, más adelante, podría mostrarse en la landing
 * o en el panel del dueño de la plataforma. El id es el del negocio (UUID),
 * que ya es público en las URLs del panel; no expone nada nuevo. Quién puede
 * subirlo o borrarlo se controla en /api/businesses/[id]/logo.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const logo = await getBusinessLogo(id)
  if (!logo) return new NextResponse('Sin logo', { status: 404 })

  const etag = `"${logo.updatedAt.getTime()}"`
  const headers: Record<string, string> = {
    ETag: etag,
    'Cache-Control': request.nextUrl.searchParams.has('v')
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  }

  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers })
  }
  return new NextResponse(new Uint8Array(logo.data), {
    headers: { ...headers, 'Content-Type': logo.contentType },
  })
}
