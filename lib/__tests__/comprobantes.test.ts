import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runAgentTool } from '../agentTools'
import { prisma } from '../db'
import * as payments from '../payments'
import { checkReceipt, chileMinutes, parseJson, receiptMessageText, toReceiptData, visionConfig, type ReceiptData } from '../receipts'
import * as store from '../store'
import type { Business, Conversation } from '../types'

const INFO = 'Banco Estado · Cuenta vista 123-4567890\nRUT 76.543.210-K · Completos de prueba'

/** "AAAA-MM-DD HH:MM" en hora de Chile, como lo muestran los comprobantes. */
function chileStamp(date: Date): string {
  const m = chileMinutes(date) * 60_000
  return new Date(m).toISOString().slice(0, 16).replace('T', ' ')
}

function receipt(over: Partial<ReceiptData> = {}): ReceiptData {
  return {
    esComprobante: true,
    monto: 7000,
    fechaHora: chileStamp(new Date()),
    estado: 'Transferencia exitosa',
    bancoDestino: 'BancoEstado',
    cuentaDestino: '****7890',
    rutDestino: null,
    titularDestino: 'Completos de prueba',
    codigo: '987654321',
    alertas: [],
    ...over,
  }
}

const ctx = (over: Partial<Parameters<typeof checkReceipt>[1]> = {}) => ({
  total: 7000,
  orderCreatedAt: new Date(Date.now() - 5 * 60_000),
  transferInfo: INFO,
  now: new Date(),
  duplicateCode: false,
  ...over,
})

describe('cruce del comprobante con el pedido', () => {
  it('calza: monto, cuenta (últimos dígitos), fecha de hoy y estado exitoso', () => {
    const r = checkReceipt(receipt(), ctx())
    expect(r.verdict).toBe('coincide')
    expect(r.items.every((i) => i.ok === true)).toBe(true)
  })

  it('reconoce la cuenta del local por el RUT de destino', () => {
    expect(checkReceipt(receipt({ cuentaDestino: null, rutDestino: '76543210-k' }), ctx()).verdict).toBe('coincide')
  })

  it('monto menor al pedido no calza', () => {
    const r = checkReceipt(receipt({ monto: 5000 }), ctx())
    expect(r.verdict).toBe('no_coincide')
    expect(r.items.find((i) => i.label === 'Monto')!.detail).toContain('el pedido es $7.000')
  })

  it('transferencia a otra cuenta no calza', () => {
    expect(checkReceipt(receipt({ cuentaDestino: '****1111' }), ctx()).verdict).toBe('no_coincide')
  })

  it('un comprobante viejo (de antes del pedido) no calza', () => {
    const ayer = chileStamp(new Date(Date.now() - 26 * 60 * 60_000))
    expect(checkReceipt(receipt({ fechaHora: ayer }), ctx()).verdict).toBe('no_coincide')
  })

  it('un código de operación ya usado en otro pedido no calza', () => {
    const r = checkReceipt(receipt(), ctx({ duplicateCode: true }))
    expect(r.verdict).toBe('no_coincide')
    expect(r.items.find((i) => i.label === 'Código de operación')!.detail).toContain('ya se usó')
  })

  it('estado rechazado o pendiente no calza', () => {
    expect(checkReceipt(receipt({ estado: 'Transferencia pendiente' }), ctx()).verdict).toBe('no_coincide')
  })

  it('señales de edición lo marcan como que no calza', () => {
    expect(checkReceipt(receipt({ alertas: ['el monto tiene otra tipografía'] }), ctx()).verdict).toBe('no_coincide')
  })

  it('si no se ve la cuenta ni la fecha queda dudoso, no aprobado', () => {
    expect(checkReceipt(receipt({ cuentaDestino: null, fechaHora: null }), ctx()).verdict).toBe('dudoso')
  })

  it('una imagen que no es comprobante, o ilegible', () => {
    expect(checkReceipt(receipt({ esComprobante: false }), ctx()).verdict).toBe('no_coincide')
    expect(checkReceipt(null, ctx()).verdict).toBe('ilegible')
  })

  it('saca el JSON aunque el modelo razone antes, con llaves sueltas', () => {
    const raw = '<think>el monto {creo} es 7000</think>Veamos {esto}. {"es_comprobante": true, "monto": 7000} listo'
    expect(parseJson(raw)).toEqual({ es_comprobante: true, monto: 7000 })
    expect(parseJson('nada útil')).toBeNull()
  })

  it('normaliza lo que devuelve la IA', () => {
    const d = toReceiptData({ es_comprobante: true, monto: '$7.000', fecha_hora: '2026-11-19 21:03', alertas: ['x', 3] })!
    expect(d.monto).toBe(7000)
    expect(d.alertas).toEqual(['x'])
    expect(toReceiptData(null)).toBeNull()
  })
})

describe('comprobante que llega por WhatsApp', () => {
  let business: Business
  let conversation: Conversation
  const handle = () => conversation.contactHandle
  const saved = { ...process.env }

  beforeEach(async () => {
    process.env.LLM_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'gsk-test'
    process.env.OPENAI_BASE_URL = 'https://api.groq.com/openai/v1'
    process.env.WHATSAPP_ACCESS_TOKEN = 'token-test'
    delete process.env.ANTHROPIC_API_KEY
    business = await store.createBusiness(
      {
        agentName: 'Rodri',
        businessName: 'Completos de prueba',
        industry: 'Comida',
        description: 'x',
        goals: 'y',
        tone: 'cercano',
        channels: ['whatsapp'],
        configuredAt: new Date().toISOString(),
      },
      'gastronomia',
    )
    await store.addProduct({ businessId: business.id, name: 'Completo italiano', price: 3500, stock: null })
    conversation = await store.createConversation({
      businessId: business.id,
      channel: 'whatsapp',
      contactName: 'Nico',
      contactHandle: `569${Date.now() % 100000000}`,
    })
    await payments.saveSalesSettings(business.id, { paymentsEnabled: true, transferInfo: INFO })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = { ...saved }
  })

  /** Simula Meta (bajar la imagen) y el modelo de visión (lo que "lee" del comprobante). */
  function mockWhatsAppAndVision(read: Record<string, unknown>) {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url)
        if (url.startsWith('https://graph.facebook.com/'))
          return new Response(JSON.stringify({ url: 'https://lookaside.fbsbx.com/img', mime_type: 'image/jpeg' }))
        if (url === 'https://lookaside.fbsbx.com/img') return new Response(new Uint8Array([1, 2, 3, 4]))
        if (url.endsWith('/chat/completions'))
          return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(read) } }] }))
        // Mensajes salientes de WhatsApp (aviso al cliente) y lo demás.
        return new Response('{}')
      }),
    )
    return calls
  }

  async function pedir() {
    await runAgentTool({ business, conversation }, 'crear_pedido', {
      items: [{ producto: 'Completo italiano', cantidad: 2 }],
      nombre_cliente: 'Nico',
    })
    return prisma.order.findFirstOrThrow({ where: { businessId: business.id }, orderBy: { createdAt: 'desc' } })
  }

  const leido = (over: Record<string, unknown> = {}) => ({
    es_comprobante: true,
    monto: 7000,
    fecha_hora: chileStamp(new Date()),
    estado: 'Exitosa',
    cuenta_destino: '123-4567890',
    codigo: `OP${Date.now()}`,
    alertas: [],
    ...over,
  })

  it('usa el modelo con visión de Groq', () => {
    expect(visionConfig()).toMatchObject({ kind: 'openai', model: 'qwen/qwen3.8-27b' })
    process.env.VISION_MODEL = 'otro/modelo'
    expect(visionConfig()).toMatchObject({ model: 'otro/modelo' })
  })

  it('lee el comprobante, lo guarda, lo cruza y deja el pedido por revisar (sin confirmar solo)', async () => {
    const order = await pedir()
    const calls = mockWhatsAppAndVision(leido())
    const text = await receiptMessageText(business, handle(), 'media-1')
    expect(text).toMatch(/^🧾/)
    expect(text).toContain('Resultado: coincide')
    expect(calls.some((u) => u.endsWith('/chat/completions'))).toBe(true)

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { receipt: true } })
    expect(after.paymentStatus).toBe('revisar')
    expect(after.receipt?.contentType).toBe('image/jpeg')
    expect((after.receiptCheck as { verdict: string }).verdict).toBe('coincide')
  })

  it('con confirmar automático activado y todo calzando, pasa a pagado', async () => {
    await payments.saveSalesSettings(business.id, { autoConfirmReceipts: true })
    const order = await pedir()
    mockWhatsAppAndVision(leido())
    const text = await receiptMessageText(business, handle(), 'media-2')
    expect(text).toContain('El pago quedó confirmado')
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('pagado')
  })

  it('aunque esté en automático, un comprobante que no calza no se confirma', async () => {
    await payments.saveSalesSettings(business.id, { autoConfirmReceipts: true })
    const order = await pedir()
    mockWhatsAppAndVision(leido({ monto: 3500 }))
    const text = await receiptMessageText(business, handle(), 'media-3')
    expect(text).toContain('no coincide')
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('revisar')
  })

  it('el mismo comprobante usado para otro pedido se detecta', async () => {
    const codigo = `OP-REPETIDO-${Date.now()}`
    await pedir()
    mockWhatsAppAndVision(leido({ codigo }))
    await receiptMessageText(business, handle(), 'media-4')
    await prisma.order.updateMany({ where: { businessId: business.id }, data: { status: 'entregado' } })

    const segundo = await pedir()
    mockWhatsAppAndVision(leido({ codigo }))
    const text = await receiptMessageText(business, handle(), 'media-5')
    expect(text).toContain('ya se usó en otro pedido')
    expect((segundo && (await prisma.order.findUniqueOrThrow({ where: { id: segundo.id } })).receiptCheck) as { verdict: string }).toMatchObject({
      verdict: 'no_coincide',
    })
  })

  it('sin pedido esperando pago, la imagen se trata como cualquier otra', async () => {
    mockWhatsAppAndVision(leido())
    expect(await receiptMessageText(business, handle(), 'media-6')).toBeNull()
  })

  it('si la IA falla, igual queda por revisar y se le pide una imagen más clara', async () => {
    const order = await pedir()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('https://graph.facebook.com/'))
          return new Response(JSON.stringify({ url: 'https://lookaside.fbsbx.com/img', mime_type: 'image/jpeg' }))
        if (url === 'https://lookaside.fbsbx.com/img') return new Response(new Uint8Array([1, 2, 3]))
        return new Response('caído', { status: 503 })
      }),
    )
    const text = await receiptMessageText(business, handle(), 'media-7')
    expect(text).toContain('Resultado: ilegible')
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('revisar')
  })
})
