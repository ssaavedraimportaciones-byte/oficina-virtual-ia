import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBusinessAccess } from '@/lib/authz'
import { decryptCredentials, findChannelOwner, getBusiness, updateBusinessCredentials } from '@/lib/store'
import { subscribeWhatsAppWebhooks, verifyInstagramAccount, verifyWhatsAppNumber } from '@/lib/metaConnect'

const connectSchema = z.object({
  channel: z.enum(['whatsapp', 'instagram']),
  accountId: z.string().min(1),
  token: z.string().min(1),
})

/**
 * Conecta un canal a un negocio: valida contra Meta que el par
 * (cuenta, token) funcione de verdad y recién ahí lo guarda, para no dejar
 * credenciales rotas que fallarían más tarde con el primer cliente real.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const body = await request.json()
  const parsed = connectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const business = await getBusiness(id)
  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const { channel, accountId, token } = parsed.data

  // Todos los números llegan al mismo webhook y se reparten por este ID: si ya
  // es de otra empresa, conectarlo acá le robaría los mensajes a esa empresa.
  const owner = await findChannelOwner(channel, accountId)
  if (owner && owner !== id) {
    return NextResponse.json(
      { error: 'Esa cuenta ya está conectada a otra empresa de la plataforma.' },
      { status: 409 },
    )
  }

  let label: string
  try {
    if (channel === 'whatsapp') {
      const info = await verifyWhatsAppNumber(accountId, token)
      label = info.verifiedName
        ? `${info.displayPhoneNumber} (${info.verifiedName})`
        : info.displayPhoneNumber
    } else {
      const info = await verifyInstagramAccount(accountId, token)
      label = `@${info.username}`
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo validar la cuenta' },
      { status: 502 },
    )
  }

  const credentials =
    channel === 'whatsapp'
      ? {
          ...decryptCredentials(business.credentials),
          whatsappPhoneNumberId: accountId,
          whatsappAccessToken: token,
        }
      : {
          ...decryptCredentials(business.credentials),
          instagramPageId: accountId,
          instagramAccessToken: token,
        }

  await updateBusinessCredentials(id, credentials)

  // Para que Meta mande los mensajes de este número al webhook. Si no se pudo,
  // la conexión queda guardada igual (puede estar suscrita desde Meta) pero se
  // avisa qué falta, en vez de que el agente quede mudo sin explicación.
  let warning: string | undefined
  if (channel === 'whatsapp') {
    const subscription = await subscribeWhatsAppWebhooks(accountId, token)
    if (!subscription.subscribed) warning = subscription.reason
  }

  return NextResponse.json({ ok: true, label, warning })
}

const disconnectSchema = z.object({
  channel: z.enum(['whatsapp', 'instagram']),
})

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const body = await request.json()
  const parsed = disconnectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const business = await getBusiness(id)
  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const credentials =
    parsed.data.channel === 'whatsapp'
      ? { ...decryptCredentials(business.credentials), whatsappPhoneNumberId: null, whatsappAccessToken: null }
      : { ...decryptCredentials(business.credentials), instagramPageId: null, instagramAccessToken: null }

  await updateBusinessCredentials(id, credentials)
  return NextResponse.json({ ok: true })
}
