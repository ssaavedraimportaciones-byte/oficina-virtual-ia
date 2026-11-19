import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createApiKey, listApiAccess, listApiKeys } from '@/lib/apiKeys'
import { requirePlatformAdmin } from '@/lib/authz'

export const dynamic = 'force-dynamic'

/** Claves de la API v1 y sus últimos accesos. Nunca devuelve el texto de una clave ya creada. */
export async function GET() {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin
  const [keys, access] = await Promise.all([listApiKeys(), listApiAccess(50)])
  return NextResponse.json({ keys, access })
}

const schema = z.object({ name: z.string().trim().min(1).max(80) })

/** Crea una clave de solo lectura. La respuesta trae el texto completo UNA vez. */
export async function POST(request: NextRequest) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Ponle un nombre a la clave (ej. Houston Ops).' }, { status: 400 })
  const { info, key } = await createApiKey(parsed.data.name, admin.id)
  return NextResponse.json({ key: info, secret: key }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
