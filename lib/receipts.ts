import Anthropic from '@anthropic-ai/sdk'
import { formatPrice } from './catalog'
import { prisma } from './db'
import { downloadWhatsAppMedia } from './incomingMedia'
import { env } from './llm/env'
import { providerStatus } from './llm'
import { notifyPaymentToReview } from './notifications'
import { confirmPayment, getSalesSettings } from './payments'
import type { Business, ChannelCredentials } from './types'

/**
 * Comprobantes de transferencia que manda el cliente por WhatsApp.
 *
 * La IA lee la imagen y saca los datos (monto, cuenta y RUT de destino, fecha,
 * estado, código de operación). Después, con código y sin IA, se cruzan con el
 * pedido y con los datos de transferencia del local, y se busca si el código
 * ya se usó en otro pedido. El resultado le sirve al agente para contestar y
 * al local para confirmar con un toque.
 *
 * Límite honesto: una imagen bien editada puede pasar todos los controles.
 * La prueba definitiva es ver la plata en la cuenta (o pagar con link). Por
 * eso confirmar solo es opcional y viene apagado.
 */

/** Marca de los mensajes con la lectura de un comprobante; el prompt del agente la reconoce. */
export const RECEIPT_MARK = '🧾'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const VISION_TIMEOUT_MS = 25_000

export interface ReceiptData {
  esComprobante: boolean
  monto: number | null
  /** "AAAA-MM-DD HH:MM", hora de Chile como aparece en el comprobante. */
  fechaHora: string | null
  estado: string | null
  bancoDestino: string | null
  cuentaDestino: string | null
  rutDestino: string | null
  titularDestino: string | null
  codigo: string | null
  /** Señales de que la imagen fue editada, según la IA. */
  alertas: string[]
}

export type ReceiptVerdict = 'coincide' | 'dudoso' | 'no_coincide' | 'ilegible'

export interface ReceiptCheckItem {
  label: string
  /** true = calza, false = no calza, null = no se pudo ver. */
  ok: boolean | null
  detail: string
}

export interface ReceiptCheck {
  verdict: ReceiptVerdict
  items: ReceiptCheckItem[]
  data: ReceiptData | null
  readAt: string
}

// ---------------------------------------------------------------------------
// Cruce con el pedido (puro: se prueba sin IA)

const digits = (v: string) => v.replace(/\D/g, '')
const rutKey = (v: string) => v.replace(/[^0-9kK]/g, '').toUpperCase()

/** Minutos desde 1970 de una fecha, en hora de Chile (para comparar con lo que dice el comprobante). */
export function chileMinutes(date: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute) / 60_000
}

function receiptMinutes(value: string): number | null {
  const m = value.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (!m) return null
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60_000
}

/** Si el destino del comprobante es la cuenta del local (por número de cuenta o RUT). */
function destinationMatches(data: ReceiptData, transferInfo: string): boolean | null {
  const info = digits(transferInfo)
  const infoRut = rutKey(transferInfo)
  const checks: boolean[] = []
  const account = data.cuentaDestino ? digits(data.cuentaDestino) : ''
  // Los comprobantes suelen mostrar solo los últimos dígitos de la cuenta.
  if (account.length >= 4) checks.push(info.includes(account.slice(-4)))
  const rut = data.rutDestino ? rutKey(data.rutDestino) : ''
  if (rut.length >= 7) checks.push(infoRut.includes(rut.replace(/^0+/, '')))
  if (checks.length === 0) return null
  return checks.some(Boolean)
}

export function checkReceipt(
  data: ReceiptData | null,
  ctx: { total: number; orderCreatedAt: Date; transferInfo: string; now: Date; duplicateCode: boolean },
): Omit<ReceiptCheck, 'readAt'> {
  if (!data) {
    return {
      verdict: 'ilegible',
      data: null,
      items: [{ label: 'Lectura', ok: null, detail: 'No se pudo leer la imagen.' }],
    }
  }
  if (!data.esComprobante) {
    return {
      verdict: 'no_coincide',
      data,
      items: [{ label: 'Comprobante', ok: false, detail: 'La imagen no parece un comprobante de transferencia.' }],
    }
  }

  const items: ReceiptCheckItem[] = []

  if (data.monto === null) items.push({ label: 'Monto', ok: null, detail: 'No se ve el monto.' })
  else if (data.monto >= ctx.total)
    items.push({ label: 'Monto', ok: true, detail: `${formatPrice(data.monto)} (pedido ${formatPrice(ctx.total)})` })
  else items.push({ label: 'Monto', ok: false, detail: `${formatPrice(data.monto)}, pero el pedido es ${formatPrice(ctx.total)}` })

  const dest = destinationMatches(data, ctx.transferInfo)
  const destLabel = [data.bancoDestino, data.cuentaDestino, data.rutDestino].filter(Boolean).join(' · ') || 'sin datos'
  items.push({
    label: 'Cuenta de destino',
    ok: dest,
    detail: dest === null ? 'No se ven la cuenta ni el RUT de destino.' : dest ? destLabel : `${destLabel}: no es la cuenta del local`,
  })

  const when = data.fechaHora ? receiptMinutes(data.fechaHora) : null
  if (when === null) items.push({ label: 'Fecha y hora', ok: null, detail: 'No se ve la fecha.' })
  else {
    const from = chileMinutes(ctx.orderCreatedAt) - 15
    const to = chileMinutes(ctx.now) + 10
    const ok = when >= from && when <= to
    items.push({
      label: 'Fecha y hora',
      ok,
      detail: ok ? data.fechaHora! : `${data.fechaHora}: es anterior al pedido o no corresponde a hoy`,
    })
  }

  if (data.estado) {
    const failed = /rechaz|fallid|pendiente|anulad|revers/i.test(data.estado)
    const success = /exitos|aprobad|realizad|complet|enviad|ok\b|correct/i.test(data.estado)
    items.push({ label: 'Estado', ok: failed ? false : success ? true : null, detail: data.estado })
  }

  if (data.codigo) {
    items.push({
      label: 'Código de operación',
      ok: !ctx.duplicateCode,
      detail: ctx.duplicateCode ? `${data.codigo}: ya se usó en otro pedido` : data.codigo,
    })
  }

  if (data.alertas.length > 0) {
    items.push({ label: 'Señales de edición', ok: false, detail: data.alertas.join('; ') })
  }

  const anyFail = items.some((i) => i.ok === false)
  const core = items.filter((i) => ['Monto', 'Cuenta de destino', 'Fecha y hora'].includes(i.label))
  const verdict: ReceiptVerdict = anyFail ? 'no_coincide' : core.every((i) => i.ok === true) ? 'coincide' : 'dudoso'
  return { verdict, data, items }
}

// ---------------------------------------------------------------------------
// Lectura con IA

const PROMPT = `Eres un revisor de comprobantes de transferencias bancarias chilenas (Banco Estado, Santander, BCI, Chile, Itaú, Scotiabank, Falabella, Mach, Tenpo, Mercado Pago, etc.).
Mira la imagen y responde SOLO un objeto JSON, sin texto alrededor, con estas claves:
{"es_comprobante": boolean, "monto": number|null (en pesos, sin puntos ni signo), "fecha_hora": "AAAA-MM-DD HH:MM"|null, "estado": string|null, "banco_destino": string|null, "cuenta_destino": string|null, "rut_destino": string|null, "titular_destino": string|null, "codigo": string|null (número de operación o comprobante), "alertas": string[]}
- Copia los datos tal como aparecen; si algo no se ve, usa null. No adivines.
- En "alertas" anota solo señales concretas de que la imagen fue editada o armada (tipografías o alineaciones distintas en el monto, números superpuestos, recortes raros, fecha imposible). Si se ve normal, deja [].`

/**
 * El JSON de la respuesta. Los modelos que razonan pueden escribir antes su
 * razonamiento (con llaves sueltas incluidas): se descarta el <think> y se busca
 * el último objeto que trae "es_comprobante".
 */
export function parseJson(text: string): Record<string, unknown> | null {
  const clean = text.replace(/<think>[\s\S]*?<\/think>/g, '')
  const starts = [...clean.matchAll(/\{\s*"es_comprobante"/g)].map((m) => m.index!).reverse()
  for (const start of starts) {
    for (let end = clean.lastIndexOf('}'); end > start; end = clean.lastIndexOf('}', end - 1)) {
      try {
        return JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>
      } catch {
        // probar con una llave de cierre anterior
      }
    }
  }
  return null
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null)

export function toReceiptData(raw: Record<string, unknown> | null): ReceiptData | null {
  if (!raw) return null
  const monto =
    typeof raw.monto === 'number' ? raw.monto : typeof raw.monto === 'string' ? Number(digits(raw.monto)) || null : null
  return {
    esComprobante: raw.es_comprobante === true,
    monto: monto !== null && Number.isFinite(monto) ? Math.round(monto) : null,
    fechaHora: str(raw.fecha_hora),
    estado: str(raw.estado),
    bancoDestino: str(raw.banco_destino),
    cuentaDestino: str(raw.cuenta_destino),
    rutDestino: str(raw.rut_destino),
    titularDestino: str(raw.titular_destino),
    codigo: str(raw.codigo),
    alertas: Array.isArray(raw.alertas) ? raw.alertas.filter((a): a is string => typeof a === 'string').slice(0, 5) : [],
  }
}

/** Qué modelo con visión usar, según la IA configurada. null = no hay. */
export function visionConfig():
  | { kind: 'anthropic'; model: string }
  | { kind: 'openai'; url: string; apiKey: string; model: string }
  | null {
  const status = providerStatus()
  const override = env('VISION_MODEL')
  if (status.id === 'anthropic') return { kind: 'anthropic', model: override ?? status.model ?? 'claude-sonnet-5' }
  if (status.id !== 'openai') return null
  const apiKey = env('OPENAI_API_KEY') ?? ''
  const base = env('OPENAI_BASE_URL')
  if (!base) return { kind: 'openai', url: 'https://api.openai.com/v1/chat/completions', apiKey, model: override ?? 'gpt-4o-mini' }
  const url = `${base.replace(/\/+$/, '')}/chat/completions`
  try {
    if (new URL(base).host === 'api.groq.com') {
      // Groq retiró Llama 4 Scout en julio de 2026; su página de visión indica Qwen 3.8 27B.
      return { kind: 'openai', url, apiKey, model: override ?? 'qwen/qwen3.8-27b' }
    }
  } catch {
    return null
  }
  // Otro servidor compatible: solo si se dice explícitamente qué modelo ve imágenes.
  return override ? { kind: 'openai', url, apiKey, model: override } : null
}

export async function readReceiptImage(bytes: Uint8Array, mimeType: string): Promise<ReceiptData | null> {
  const config = visionConfig()
  if (!config) return null
  const b64 = Buffer.from(bytes).toString('base64')

  if (config.kind === 'anthropic') {
    const client = new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), timeout: VISION_TIMEOUT_MS, maxRetries: 1 })
    const res = await client.messages.create({
      model: config.model,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: b64 },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    })
    const text = res.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
    return toReceiptData(parseJson(text))
  }

  const res = await fetch(config.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`El modelo de visión respondió ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return toReceiptData(parseJson(data.choices?.[0]?.message?.content ?? ''))
}

// ---------------------------------------------------------------------------
// Flujo: llega una imagen de un cliente con un pedido esperando pago

const INSTRUCTION: Record<ReceiptVerdict, string> = {
  coincide:
    'Agradécele, dile que el comprobante calza y que apenas el local vea la transferencia en su cuenta el pedido entra a cocina. No digas que ya está pagado.',
  dudoso:
    'Dile que lo recibiste y que el local lo revisa. Si falta un dato (fecha, cuenta, monto), pídele con amabilidad una captura del comprobante completo.',
  no_coincide:
    'Explícale con amabilidad qué no calza (sin acusarlo de nada) y pídele que lo revise o mande el comprobante correcto. El pedido sigue esperando el pago.',
  ilegible: 'Dile que no se alcanza a leer y pídele una captura más clara del comprobante completo.',
}

function summary(check: Omit<ReceiptCheck, 'readAt'>): string {
  return check.items.map((i) => `${i.ok === true ? '✓' : i.ok === false ? '✗' : '?'} ${i.label}: ${i.detail}`).join('; ')
}

/**
 * Si el contacto tiene un pedido esperando pago, toma la imagen como su
 * comprobante: la guarda, la lee, la cruza y devuelve el texto que entra a la
 * conversación. Si no tiene pedido pendiente devuelve null (la imagen se trata
 * como cualquier otra). Nunca lanza.
 */
export async function receiptMessageText(
  business: Business,
  contactHandle: string,
  mediaId: string,
  credentials?: ChannelCredentials,
): Promise<string | null> {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { businessId: business.id, channel: 'whatsapp', contactHandle },
      select: { id: true },
    })
    if (!conversation) return null
    const order = await prisma.order.findFirst({
      where: {
        businessId: business.id,
        conversationId: conversation.id,
        status: 'pendiente',
        paymentStatus: { in: ['esperando', 'revisar'] },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!order) return null

    const settings = await getSalesSettings(business.id)
    let data: ReceiptData | null = null
    try {
      const media = await downloadWhatsAppMedia(mediaId, credentials)
      if (media.bytes.length <= MAX_IMAGE_BYTES && media.mimeType.startsWith('image/')) {
        await prisma.orderReceipt.upsert({
          where: { orderId: order.id },
          create: { orderId: order.id, contentType: media.mimeType, data: Buffer.from(media.bytes) },
          update: { contentType: media.mimeType, data: Buffer.from(media.bytes), createdAt: new Date() },
        })
        data = await readReceiptImage(media.bytes, media.mimeType)
      }
    } catch (error) {
      console.error('[comprobante] no se pudo bajar o leer la imagen:', error instanceof Error ? error.message : error)
    }

    const code = data?.codigo ? digits(data.codigo) || data.codigo : null
    const duplicateCode = code
      ? (await prisma.order.count({ where: { businessId: business.id, receiptCode: code, id: { not: order.id } } })) > 0
      : false
    const check = checkReceipt(data, {
      total: order.total,
      orderCreatedAt: order.createdAt,
      transferInfo: settings.transferInfo,
      now: new Date(),
      duplicateCode,
    })
    const stored: ReceiptCheck = { ...check, readAt: new Date().toISOString() }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        receiptCheck: stored as unknown as object,
        receiptCode: code,
        paymentStatus: 'revisar',
        paymentMethod: 'transferencia',
      },
    })

    if (check.verdict === 'coincide' && settings.autoConfirmReceipts) {
      await confirmPayment(order.id, 'transferencia')
      return `${RECEIPT_MARK} [El contacto mandó el comprobante de su pedido y calza en todo (${summary(check)}). El pago quedó confirmado y el cliente ya recibió el aviso de que su pedido entró a cocina: solo agradécele en una frase.]`
    }

    await notifyPaymentToReview(
      business.id,
      business.config.businessName,
      order.contactName,
      `${formatPrice(order.total)} · comprobante: ${check.verdict.replace('_', ' ')}`,
    ).catch((error) => console.error('[comprobante] no se pudo avisar al local:', error))

    return `${RECEIPT_MARK} [El contacto mandó una imagen como comprobante de pago de su pedido de ${formatPrice(order.total)}. Revisión automática: ${summary(check)}. Resultado: ${check.verdict.replace('_', ' ')}. ${INSTRUCTION[check.verdict]}]`
  } catch (error) {
    console.error('[comprobante] falló la revisión:', error)
    return null
  }
}
