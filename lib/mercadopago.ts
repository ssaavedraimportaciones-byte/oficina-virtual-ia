/**
 * Mercado Pago con el access token de cada negocio (cada local cobra en su
 * propia cuenta; ZeroVisto no toca la plata).
 *
 * Para confirmar un pago nunca se confía en lo que llega al webhook: se usa
 * solo el id para consultar el pago a la API con el token del negocio, y ahí
 * se mira el estado, el monto y a qué pedido corresponde. Un aviso falso no
 * puede marcar nada como pagado.
 */

const API = 'https://api.mercadopago.com'
const TIMEOUT_MS = 10_000

export interface PreferenceItem {
  title: string
  quantity: number
  unitPrice: number
}

async function mp(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
}

/** Valida que el token sirva antes de guardarlo. */
export async function checkMercadoPagoToken(token: string): Promise<boolean> {
  try {
    const res = await mp(token, '/users/me')
    return res.ok
  } catch {
    return false
  }
}

/** Crea el link de pago de un pedido. Devuelve la URL para mandarle al cliente. */
export async function createPaymentLink(
  token: string,
  input: { orderId: string; items: PreferenceItem[]; notificationUrl: string; expiresAt: Date; businessName: string },
): Promise<string> {
  const res = await mp(token, '/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: input.items.map((i) => ({
        title: i.title,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        currency_id: 'CLP',
      })),
      external_reference: input.orderId,
      notification_url: input.notificationUrl,
      statement_descriptor: input.businessName.slice(0, 22),
      expires: true,
      expiration_date_to: input.expiresAt.toISOString(),
      date_of_expiration: input.expiresAt.toISOString(),
    }),
  })
  if (!res.ok) throw new Error(`Mercado Pago respondió ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { init_point?: string }
  if (!data.init_point) throw new Error('Mercado Pago no devolvió el link de pago')
  return data.init_point
}

export interface MpPayment {
  status: string
  orderId: string | null
  amount: number
}

/** Consulta un pago por su id, con el token del negocio. null si no existe para esa cuenta. */
export async function getPayment(token: string, paymentId: string): Promise<MpPayment | null> {
  if (!/^\d+$/.test(paymentId)) return null
  const res = await mp(token, `/v1/payments/${paymentId}`)
  if (!res.ok) return null
  const data = (await res.json()) as { status?: string; external_reference?: string | null; transaction_amount?: number }
  return {
    status: data.status ?? 'unknown',
    orderId: data.external_reference ?? null,
    amount: Number(data.transaction_amount ?? 0),
  }
}
