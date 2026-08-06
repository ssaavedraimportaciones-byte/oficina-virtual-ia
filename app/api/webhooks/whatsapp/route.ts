import { NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage } from '@/lib/agentPipeline'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

// Handshake de verificación que pide Meta al configurar el webhook.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const mode = params.get('hub.mode')
  const token = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Token inválido', { status: 403 })
}

interface WhatsAppWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>
        messages?: Array<{ from: string; text?: { body: string }; type: string }>
      }
    }>
  }>
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as WhatsAppWebhookBody

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      const contact = value?.contacts?.[0]
      for (const message of value?.messages ?? []) {
        if (message.type !== 'text' || !message.text) continue

        const { reply } = await handleIncomingMessage({
          channel: 'whatsapp',
          contactHandle: message.from,
          contactName: contact?.profile?.name ?? message.from,
          text: message.text.body,
        })

        await sendWhatsAppMessage(message.from, reply)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
