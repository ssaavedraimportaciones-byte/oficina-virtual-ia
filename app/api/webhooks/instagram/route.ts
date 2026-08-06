import { NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage } from '@/lib/agentPipeline'
import { getInstagramContactProfile, sendInstagramMessage } from '@/lib/instagram'
import { findBusinessByChannelId, findConversationByContact } from '@/lib/store'

// Handshake de verificación que pide Meta al configurar el webhook.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const mode = params.get('hub.mode')
  const token = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Token inválido', { status: 403 })
}

interface InstagramWebhookBody {
  entry?: Array<{
    id?: string
    messaging?: Array<{
      sender?: { id: string }
      message?: { text?: string; is_echo?: boolean }
    }>
  }>
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as InstagramWebhookBody

  for (const entry of body.entry ?? []) {
    // entry.id es la cuenta de Instagram que recibió el mensaje: define el negocio.
    if (!entry.id) continue
    const business = await findBusinessByChannelId('instagram', entry.id)
    if (!business) continue

    for (const event of entry.messaging ?? []) {
      const text = event.message?.text
      const senderId = event.sender?.id
      // is_echo: eventos que genera la propia cuenta al enviar un mensaje, se ignoran.
      if (!text || !senderId || event.message?.is_echo) continue

      // Si falla la generación o el envío, el mensaje del cliente ya quedó
      // guardado en la conversación: se registra el error y se sigue, en vez
      // de devolver un 5xx que haría a Meta reintentar el webhook en loop.
      try {
        // Solo consultamos el perfil si es un contacto nuevo, para no gastar
        // llamadas de más en cada mensaje de una conversación ya existente.
        const existing = await findConversationByContact(business.id, 'instagram', senderId)
        const contactName = existing
          ? existing.contactName
          : (await getInstagramContactProfile(senderId, business.credentials)).name ?? senderId

        const { reply } = await handleIncomingMessage({
          business,
          channel: 'instagram',
          contactHandle: senderId,
          contactName,
          text,
        })

        await sendInstagramMessage(senderId, reply, business.credentials)
      } catch (error) {
        console.error('[webhook instagram] no se pudo responder:', error)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
