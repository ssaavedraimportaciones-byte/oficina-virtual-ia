import { NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage } from '@/lib/agentPipeline'
import { sendInstagramMessage } from '@/lib/instagram'

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

      const { reply } = await handleIncomingMessage({
        channel: 'instagram',
        contactHandle: senderId,
        contactName: senderId,
        text,
      })

      await sendInstagramMessage(senderId, reply)
    }
  }

  return NextResponse.json({ ok: true })
}
