import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getBusiness, updateBusinessCredentials } from '@/lib/store'
import { verifyInstagramAccount, verifyWhatsAppNumber } from '@/lib/metaConnect'

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
          ...business.credentials,
          whatsappPhoneNumberId: accountId,
          whatsappAccessToken: token,
        }
      : {
          ...business.credentials,
          instagramPageId: accountId,
          instagramAccessToken: token,
        }

  await updateBusinessCredentials(id, credentials)
  return NextResponse.json({ ok: true, label })
}

const disconnectSchema = z.object({
  channel: z.enum(['whatsapp', 'instagram']),
})

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
      ? { ...business.credentials, whatsappPhoneNumberId: null, whatsappAccessToken: null }
      : { ...business.credentials, instagramPageId: null, instagramAccessToken: null }

  await updateBusinessCredentials(id, credentials)
  return NextResponse.json({ ok: true })
}
