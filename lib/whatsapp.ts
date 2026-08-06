import type { ChannelCredentials } from './types'

const GRAPH_VERSION = 'v20.0'

/**
 * Resuelve las credenciales a usar: primero las propias del negocio, y si no
 * las cargó, las de las variables de entorno. Eso permite tanto una agencia
 * con una sola app de Meta para todos sus clientes como negocios con su propia
 * cuenta conectada.
 */
function resolveCredentials(credentials?: ChannelCredentials) {
  return {
    token: credentials?.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: credentials?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID,
  }
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
        text: { body: text },
      }),
    },
  )

  if (!res.ok) {
    throw new Error(`WhatsApp API respondió ${res.status}: ${await res.text()}`)
  }
}
