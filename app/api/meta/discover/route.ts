import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { discoverInstagramAccounts, discoverWhatsAppNumbers } from '@/lib/metaConnect'

const schema = z.object({
  channel: z.enum(['whatsapp', 'instagram']),
  token: z.string().min(1),
})

/**
 * Recibe un token de Meta y devuelve las cuentas a las que da acceso, para
 * elegirlas de una lista. El token no se guarda acá: eso lo hace el paso de
 * conexión una vez que el usuario eligió la cuenta.
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const accounts =
      parsed.data.channel === 'whatsapp'
        ? await discoverWhatsAppNumbers(parsed.data.token)
        : await discoverInstagramAccounts(parsed.data.token)
    return NextResponse.json({ accounts })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudieron leer las cuentas' },
      { status: 502 },
    )
  }
}
