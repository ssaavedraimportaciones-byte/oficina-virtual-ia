import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlatformAdmin } from '@/lib/authz'
import { getMaintenance, setMaintenance } from '@/lib/platform'

export async function GET() {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin
  return NextResponse.json({ maintenance: await getMaintenance() })
}

const schema = z.object({
  enabled: z.boolean(),
  message: z.string().trim().min(1, 'El mensaje no puede estar vacío').max(500),
})

/**
 * Prende o apaga el modo mantenimiento. Prendido, el agente no responde en
 * ninguna empresa y los clientes finales reciben `message`.
 */
export async function PUT(request: NextRequest) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }
  return NextResponse.json({ maintenance: await setMaintenance(parsed.data) })
}
