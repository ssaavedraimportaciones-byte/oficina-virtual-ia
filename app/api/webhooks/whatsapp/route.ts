import { after, NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage } from '@/lib/agentPipeline'
import { decryptCredentials, findBusinessByChannelId } from '@/lib/store'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { verifyMetaSignature } from '@/lib/webhookSignature'

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

interface WhatsAppMessage {
  id?: string
  from: string
  type: string
  text?: { body: string }
  button?: { text?: string }
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } }
}

interface WhatsAppWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string }
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>
        messages?: WhatsAppMessage[]
      }
    }>
  }>
}

const MEDIA_LABELS: Record<string, string> = {
  audio: 'un audio',
  voice: 'un audio',
  image: 'una imagen',
  video: 'un video',
  sticker: 'un sticker',
  document: 'un archivo',
  location: 'una ubicación',
  contacts: 'un contacto',
}

/**
 * Lo que dijo el contacto, en texto. Los botones y listas traen el texto de
 * la opción elegida. Audios, fotos y demás el agente no los puede ver: se
 * registran como una nota para que conteste pidiendo que lo escriba, en vez
 * de dejar al cliente sin respuesta.
 */
function messageText(message: WhatsAppMessage): string | null {
  if (message.type === 'text') return message.text?.body ?? null
  if (message.type === 'button') return message.button?.text ?? null
  if (message.type === 'interactive') {
    return message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? null
  }
  const label = MEDIA_LABELS[message.type]
  return label ? `[El contacto envió ${label}]` : null
}

// Da margen al debounce de ráfagas más la respuesta del modelo con herramientas.
export const maxDuration = 60

async function processWebhook(body: WhatsAppWebhookBody): Promise<void> {
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
        const text = messageText(message)
        if (!text) continue

        // Si falla la generación o el envío, el mensaje del cliente ya quedó
        // guardado en la conversación: se registra el error y se sigue.
        try {
          await handleIncomingMessage(
            {
              business,
              channel: 'whatsapp',
              contactHandle: message.from,
              contactName: contact?.profile?.name ?? message.from,
              text,
              externalId: message.id,
            },
            {
              send: (reply) =>
                sendWhatsAppMessage(message.from, reply, decryptCredentials(business.credentials)),
              defer: after,
            },
          )
        } catch (error) {
          console.error('[webhook whatsapp] no se pudo responder:', error)
        }
      }
    }
  }
}

export async function POST(request: NextRequest) {
  // La firma se calcula sobre el cuerpo crudo, así que hay que leerlo como
  // texto y recién después parsearlo.
  const rawBody = await request.text()
  const signature = verifyMetaSignature(rawBody, request.headers.get('x-hub-signature-256'))
  if (!signature.ok) {
    console.error('[webhook whatsapp] rechazado:', signature.reason)
    return NextResponse.json({ error: signature.reason }, { status: signature.status })
  }

  let body: WhatsAppWebhookBody
  try {
    body = JSON.parse(rawBody) as WhatsAppWebhookBody
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  // Se le contesta a Meta enseguida y el trabajo sigue después: si tarda en
  // recibir el 200, reintenta el webhook. Los reintentos que igual lleguen los
  // descarta el pipeline por el ID del mensaje.
  after(() => processWebhook(body))
  return NextResponse.json({ ok: true })
}
