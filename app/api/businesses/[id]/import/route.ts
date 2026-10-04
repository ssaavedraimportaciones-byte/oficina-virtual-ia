import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBusinessAccess } from '@/lib/authz'
import { IntegrationError, importCatalog } from '@/lib/integrations'

const schema = z.object({
  source: z.enum(['woocommerce', 'jumpseller']),
  // Las credenciales son de la tienda del negocio; no se guardan, se usan solo
  // para esta importación.
  credentials: z.record(z.string(), z.string()).default({}),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  try {
    const summary = await importCatalog(id, parsed.data.source, parsed.data.credentials)
    return NextResponse.json({ summary })
  } catch (error) {
    // Los mensajes de IntegrationError están pensados para mostrárselos al dueño.
    if (error instanceof IntegrationError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json({ error: 'No se pudo importar el catálogo.' }, { status: 502 })
  }
}
