import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Meta firma cada webhook con el App Secret sobre el cuerpo crudo del pedido.
 * Sin verificar esa firma, cualquiera puede inventar mensajes entrantes:
 * ensucia el CRM y hace gastar créditos de la API generando respuestas a
 * conversaciones que nunca existieron.
 */
export type SignatureCheck =
  | { ok: true }
  | { ok: false; status: number; reason: string }

export function verifyMetaSignature(rawBody: string, header: string | null): SignatureCheck {
  const secret = process.env.META_APP_SECRET
  if (!secret) {
    // Falla cerrado a propósito: sin secreto no hay forma de distinguir un
    // webhook real de uno falso.
    return {
      ok: false,
      status: 503,
      reason: 'Falta META_APP_SECRET: no se puede verificar la firma del webhook.',
    }
  }

  if (!header?.startsWith('sha256=')) {
    return { ok: false, status: 401, reason: 'Falta la cabecera X-Hub-Signature-256.' }
  }

  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const received = header.slice('sha256='.length)

  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(received, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, reason: 'Firma inválida.' }
  }

  return { ok: true }
}
