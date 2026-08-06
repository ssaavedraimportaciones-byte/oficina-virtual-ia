import { NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage } from '@/lib/agentPipeline'
import { findBusinessByChannelId } from '@/lib/store'
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
        metadata?: { phone_number_id?: string }
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
      // El número al que le escribieron define de qué negocio es el mensaje.
      const phoneNumberId = value?.metadata?.phone_number_id
      if (!phoneNumberId) continue

      const business = await findBusinessByChannelId('whatsapp', phoneNumberId)
      if (!business) continue

      for (const message of value?.messages ?? []) {
        if (message.type !== 'text' || !message.text) continue

        // Si falla la generación o el envío, el mensaje del cliente ya quedó
        // guardado en la conversación: se registra el error y se sigue, en vez
        // de devolver un 5xx que haría a Meta reintentar el webhook en loop.
        try {
          const { reply } = await handleIncomingMessage({
            business,
            channel: 'whatsapp',
            contactHandle: message.from,
            contactName: contact?.profile?.name ?? message.from,
            text: message.text.body,
          })

          await sendWhatsAppMessage(message.from, reply, business.credentials)
        } catch (error) {
          console.error('[webhook whatsapp] no se pudo responder:', error)
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
