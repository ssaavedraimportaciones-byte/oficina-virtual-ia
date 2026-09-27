import { after, NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage } from '@/lib/agentPipeline'
import { getInstagramContactProfile, sendInstagramMessage } from '@/lib/instagram'
import {
  decryptCredentials,
  findBusinessByChannelId,
  findConversationByContact,
} from '@/lib/store'
import { verifyMetaSignature } from '@/lib/webhookSignature'

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

interface InstagramMessage {
  mid?: string
  text?: string
  is_echo?: boolean
  attachments?: Array<{ type?: string }>
}

interface InstagramWebhookBody {
  entry?: Array<{
    id?: string
    messaging?: Array<{
      sender?: { id: string }
      message?: InstagramMessage
    }>
  }>
}

const ATTACHMENT_LABELS: Record<string, string> = {
  audio: 'un audio',
  image: 'una imagen',
  video: 'un video',
  file: 'un archivo',
  share: 'una publicación',
  story_mention: 'una mención en su historia',
  ig_reel: 'un reel',
  reel: 'un reel',
}

/**
 * Texto del mensaje. Fotos, audios y publicaciones compartidas el agente no
 * los puede ver: se registran como una nota para que conteste pidiendo que lo
 * escriba, en vez de dejar al cliente sin respuesta.
 */
function messageText(message: InstagramMessage | undefined): string | null {
  if (!message) return null
  if (message.text) return message.text
  const type = message.attachments?.[0]?.type
  if (!type) return null
  return `[El contacto envió ${ATTACHMENT_LABELS[type] ?? 'un archivo'}]`
}

// Da margen al debounce de ráfagas más la respuesta del modelo con herramientas.
export const maxDuration = 60

async function processWebhook(body: InstagramWebhookBody): Promise<void> {
  for (const entry of body.entry ?? []) {
    // entry.id es la cuenta de Instagram que recibió el mensaje: define el negocio.
    if (!entry.id) continue
    const business = await findBusinessByChannelId('instagram', entry.id)
    if (!business) continue

    for (const event of entry.messaging ?? []) {
      const senderId = event.sender?.id
      // is_echo: eventos que genera la propia cuenta al enviar un mensaje, se ignoran.
      if (!senderId || event.message?.is_echo) continue
      const text = messageText(event.message)
      if (!text) continue

      // Si falla la generación o el envío, el mensaje del cliente ya quedó
      // guardado en la conversación: se registra el error y se sigue.
      try {
        // Solo consultamos el perfil si es un contacto nuevo, para no gastar
        // llamadas de más en cada mensaje de una conversación ya existente.
        const existing = await findConversationByContact(business.id, 'instagram', senderId)
        const contactName = existing
          ? existing.contactName
          : (await getInstagramContactProfile(senderId, decryptCredentials(business.credentials))).name ?? senderId

        await handleIncomingMessage(
          {
            business,
            channel: 'instagram',
            contactHandle: senderId,
            contactName,
            text,
            externalId: event.message?.mid,
          },
          {
            send: (reply) =>
              sendInstagramMessage(senderId, reply, decryptCredentials(business.credentials)),
            defer: after,
          },
        )
      } catch (error) {
        console.error('[webhook instagram] no se pudo responder:', error)
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
    console.error('[webhook instagram] rechazado:', signature.reason)
    return NextResponse.json({ error: signature.reason }, { status: signature.status })
  }

  let body: InstagramWebhookBody
  try {
    body = JSON.parse(rawBody) as InstagramWebhookBody
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  // Se le contesta a Meta enseguida y el trabajo sigue después: si tarda en
  // recibir el 200, reintenta el webhook. Los reintentos que igual lleguen los
  // descarta el pipeline por el ID del mensaje.
  after(() => processWebhook(body))
  return NextResponse.json({ ok: true })
}
