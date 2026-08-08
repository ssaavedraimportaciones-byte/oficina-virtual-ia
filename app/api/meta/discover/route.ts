import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/authz'
import { discoverInstagramAccounts, discoverWhatsAppNumbers } from '@/lib/metaConnect'

const schema = z.object({
  channel: z.enum(['whatsapp', 'instagram']),
  token: z.string().min(1),
})

/**
 * Recibe un token de Meta y devuelve las cuentas a las que da acceso, para
 * elegirlas de una lista. El token no se guarda acá: eso lo hace el paso de
 * conexión una vez que el usuario eligió la cuenta. No pide un negocio
 * puntual (todavía no se sabe a cuál se va a conectar), así que alcanza con
 * estar autenticado.
 */
export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (user instanceof NextResponse) return user

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
