import type { ChannelCredentials } from './types'

export const GRAPH_VERSION = 'v20.0'

/**
 * Resuelve las credenciales a usar: primero las propias del negocio, y si no
 * las cargó, las de las variables de entorno. Eso permite tanto una agencia
 * con una sola app de Meta para todos sus clientes como negocios con su propia
 * cuenta conectada.
 */
export function resolveCredentials(credentials?: ChannelCredentials) {
  return {
    token: credentials?.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: credentials?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID,
  }
}

/**
 * Los modelos escriben en Markdown (`**negrita**`, `### título`, `[texto](url)`),
 * pero WhatsApp tiene su propio formato: `*negrita*`, `_cursiva_`, y los links
 * van sueltos. Sin esto el cliente ve los asteriscos dobles tal cual.
 */
export function toWhatsAppFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/__(.+?)__/g, '_$1_')
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1: $2')
}

export async function sendWhatsAppMessage(
  to: string,
  text: string,
  credentials?: ChannelCredentials,
): Promise<void> {
  const { token, phoneNumberId } = resolveCredentials(credentials)
  if (!token || !phoneNumberId) {
    throw new Error('Faltan credenciales de WhatsApp para este negocio')
  }

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: toWhatsAppFormat(text) },
      }),
    },
  )

  if (!res.ok) {
    throw new Error(`WhatsApp API respondió ${res.status}: ${await res.text()}`)
  }
}
