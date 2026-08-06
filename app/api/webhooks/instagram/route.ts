import { NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage } from '@/lib/agentPipeline'
import { getInstagramContactProfile, sendInstagramMessage } from '@/lib/instagram'
import { findConversationByContact } from '@/lib/store'

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
    messaging?: Array<{
      sender?: { id: string }
      message?: { text?: string; is_echo?: boolean }
    }>
  }>
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as InstagramWebhookBody

  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      const text = event.message?.text
      const senderId = event.sender?.id
      // is_echo: eventos que genera la propia cuenta al enviar un mensaje, se ignoran.
      if (!text || !senderId || event.message?.is_echo) continue

      // Solo consultamos el perfil si es un contacto nuevo, para no gastar
      // llamadas de más en cada mensaje de una conversación ya existente.
      const existing = await findConversationByContact('instagram', senderId)
      const contactName = existing
        ? existing.contactName
        : (await getInstagramContactProfile(senderId)).name ?? senderId

      const { reply } = await handleIncomingMessage({
        channel: 'instagram',
        contactHandle: senderId,
        contactName,
        text,
      })

      await sendInstagramMessage(senderId, reply)
    }
  }

  return NextResponse.json({ ok: true })
}
