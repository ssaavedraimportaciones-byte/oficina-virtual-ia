// Meta Cloud API — WhatsApp Business
// Requires pre-approved message templates in Meta Business Manager.
// Stored in Prisma using the SMS channel with subType: 'WHATSAPP' in message JSON.

const GRAPH_API_VERSION = 'v19.0'
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN ?? ''

interface WhatsAppTextMessage {
  to: string           // E.164 format, e.g. +56912345678
  body: string
}

interface WhatsAppTemplateMessage {
  to: string
  templateName: string
  languageCode?: string
  components?: unknown[]
}

export async function sendWhatsAppText(opts: WhatsAppTextMessage): Promise<void> {
  if (!PHONE_ID || !ACCESS_TOKEN) throw new Error('WhatsApp env vars not configured')

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_ID}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to: opts.to,
    type: 'text',
    text: { body: opts.body, preview_url: false },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`WhatsApp API error ${res.status}: ${err}`)
  }
}

export async function sendWhatsAppTemplate(opts: WhatsAppTemplateMessage): Promise<void> {
  if (!PHONE_ID || !ACCESS_TOKEN) throw new Error('WhatsApp env vars not configured')

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_ID}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to: opts.to,
    type: 'template',
    template: {
      name: opts.templateName,
      language: { code: opts.languageCode ?? 'es_CL' },
      components: opts.components ?? [],
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`WhatsApp API error ${res.status}: ${err}`)
  }
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(PHONE_ID && ACCESS_TOKEN)
}
