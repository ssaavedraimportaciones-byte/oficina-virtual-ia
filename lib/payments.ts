import { appUrl } from './auth'
import { formatPrice } from './catalog'
import { prisma } from './db'
import { sendInstagramMessage } from './instagram'
import { checkMercadoPagoToken, createPaymentLink } from './mercadopago'
import { notifyPaymentToReview, notifyStockAlert } from './notifications'
import { decryptOptional, encryptOptional } from './secrets'
import { appendMessage, decryptCredentials, getBusiness, getConversation, mapOrder as toOrder, setOrderStatus } from './store'
import type { Order, PaymentMethod, SalesSettings } from './types'
import { sendWhatsAppMessage } from './whatsapp'

/**
 * Cobrar antes de preparar (pedidos de comida, tienda).
 *
 * El problema que resuelve: el cliente pide para retiro, llega, no puede
 * transferir y la comida se pierde. Con esto activado:
 *
 *  1. Al registrar el pedido, el agente le da las formas de pago (datos de
 *     transferencia y, si el negocio conectó Mercado Pago, un link) y el
 *     pedido queda "esperando pago" con un plazo.
 *  2. Transferencia: el cliente avisa o manda el comprobante, el pedido pasa a
 *     "revisar" y se avisa al local, que confirma en el panel cuando ve la plata.
 *     Mercado Pago: se confirma solo cuando la API dice que el pago se aprobó.
 *  3. Recién pagado entra a la cola de cocina (y sale el ticket) y el agente
 *     le confirma al cliente. Si vence el plazo sin pago, se anula y el stock vuelve.
 *
 * El agente nunca puede marcar un pago como recibido: lo hace una persona del
 * local o la API de Mercado Pago.
 */

const DEFAULTS: Omit<SalesSettings, 'mercadoPagoConnected'> = {
  paymentsEnabled: false,
  transferInfo: '',
  holdMinutes: 20,
  kitchenEnabled: false,
  autoConfirmReceipts: false,
  stockAlertsEnabled: false,
  stockAlertThreshold: 5,
}

export async function getSalesSettings(businessId: string): Promise<SalesSettings> {
  const row = await prisma.salesSettings.findUnique({ where: { businessId } })
  if (!row) return { ...DEFAULTS, mercadoPagoConnected: false }
  return {
    paymentsEnabled: row.paymentsEnabled,
    transferInfo: row.transferInfo,
    holdMinutes: row.holdMinutes,
    mercadoPagoConnected: Boolean(row.mercadoPagoToken),
    kitchenEnabled: row.kitchenEnabled,
    autoConfirmReceipts: row.autoConfirmReceipts,
    stockAlertsEnabled: row.stockAlertsEnabled,
    stockAlertThreshold: row.stockAlertThreshold,
  }
}

async function getMercadoPagoToken(businessId: string): Promise<string | null> {
  const row = await prisma.salesSettings.findUnique({ where: { businessId }, select: { mercadoPagoToken: true } })
  return decryptOptional(row?.mercadoPagoToken ?? null)
}

export type SalesSettingsInput = Partial<Omit<SalesSettings, 'mercadoPagoConnected'>> & {
  /** string = conectar (se valida contra Mercado Pago), null = desconectar, undefined = no tocar. */
  mercadoPagoToken?: string | null
}

export async function saveSalesSettings(
  businessId: string,
  input: SalesSettingsInput,
): Promise<{ ok: true; settings: SalesSettings } | { ok: false; error: string }> {
  const { mercadoPagoToken, ...rest } = input
  const data: Record<string, unknown> = { ...rest }
  if (mercadoPagoToken !== undefined) {
    if (mercadoPagoToken === null) {
      data.mercadoPagoToken = null
    } else {
      const token = mercadoPagoToken.trim()
      if (!(await checkMercadoPagoToken(token))) {
        return { ok: false, error: 'Mercado Pago no reconoció ese access token. Revisa que sea el de producción y que esté completo.' }
      }
      data.mercadoPagoToken = encryptOptional(token)
    }
  }
  if (data.paymentsEnabled === true) {
    const current = await getSalesSettings(businessId)
    const transfer = (data.transferInfo as string | undefined) ?? current.transferInfo
    const mp = mercadoPagoToken !== undefined ? mercadoPagoToken !== null : current.mercadoPagoConnected
    if (!transfer.trim() && !mp) {
      return { ok: false, error: 'Para pedir el pago antes de preparar, carga tus datos de transferencia o conecta Mercado Pago.' }
    }
  }
  await prisma.salesSettings.upsert({
    where: { businessId },
    create: { businessId, ...data },
    update: data,
  })
  return { ok: true, settings: await getSalesSettings(businessId) }
}

/**
 * Pide el pago de un pedido recién creado. Devuelve las instrucciones para que
 * el agente se las dé al cliente, o null si el negocio no cobra por adelantado.
 */
export async function requestPayment(order: Order, businessName: string): Promise<string | null> {
  const settings = await getSalesSettings(order.businessId)
  if (!settings.paymentsEnabled) return null

  const deadline = new Date(Date.now() + settings.holdMinutes * 60_000)
  let link: string | null = null
  const token = settings.mercadoPagoConnected ? await getMercadoPagoToken(order.businessId) : null
  if (token) {
    try {
      link = await createPaymentLink(token, {
        orderId: order.id,
        businessName,
        expiresAt: deadline,
        notificationUrl: `${appUrl()}/api/webhooks/mercadopago?b=${order.businessId}`,
        items: order.items.map((i) => ({ title: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
      })
    } catch (error) {
      // Sin link igual se puede pagar por transferencia: no se pierde el pedido.
      console.error('[pagos] no se pudo crear el link de Mercado Pago:', error)
    }
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: 'esperando', paymentDeadline: deadline, paymentLink: link },
  })

  const options: string[] = []
  if (settings.transferInfo.trim()) options.push(`Transferencia a:\n${settings.transferInfo.trim()}\n(que te avise o mande el comprobante cuando transfiera)`)
  if (link) options.push(`Pagar con tarjeta o Mercado Pago en este link (se confirma solo): ${link}`)
  if (options.length === 0) return null

  return [
    `Este local cobra ANTES de preparar. El pedido queda reservado ${settings.holdMinutes} minutos esperando el pago de ${formatPrice(order.total)}; si no se paga en ese plazo se anula solo.`,
    'Dale estas formas de pago, tal cual (no inventes otras ni cambies los datos):',
    ...options.map((o, i) => `${i + 1}) ${o}`),
    'Explícale con buena onda que el pedido entra a cocina apenas se confirme el pago. No digas que el pago está confirmado: eso lo confirma el local o el link, y tú le avisas.',
  ].join('\n')
}

/** El cliente avisa que transfirió (o manda el comprobante): queda para que el local lo revise. */
export async function claimPayment(
  businessId: string,
  conversationId: string,
): Promise<{ ok: true; order: Order } | { ok: false; reason: string }> {
  const row = await prisma.order.findFirst({
    where: { businessId, conversationId, status: 'pendiente', paymentStatus: { in: ['esperando', 'revisar'] } },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  })
  if (!row) return { ok: false, reason: 'Este cliente no tiene un pedido esperando pago.' }

  if (row.paymentStatus === 'esperando') {
    await prisma.order.update({ where: { id: row.id }, data: { paymentStatus: 'revisar', paymentMethod: 'transferencia' } })
    const business = await getBusiness(businessId)
    if (business) {
      await notifyPaymentToReview(businessId, business.config.businessName, row.contactName, formatPrice(row.total)).catch(
        (error) => console.error('[pagos] no se pudo avisar la transferencia:', error),
      )
    }
  }
  const order = await prisma.order.findUniqueOrThrow({ where: { id: row.id }, include: { items: true } })
  return { ok: true, order: toOrder(order) }
}

/**
 * Marca un pedido como pagado (lo llama el panel o el webhook de Mercado Pago).
 * Es idempotente: confirmar dos veces no avisa dos veces. Si el pago llega
 * después de que el pedido se anuló por plazo, se reactiva: la plata ya entró.
 */
export async function confirmPayment(orderId: string, method: PaymentMethod): Promise<Order | null> {
  const existing = await prisma.order.findUnique({ where: { id: orderId } })
  if (!existing) return null
  if (existing.paymentStatus === 'pagado') return toOrder(await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } }))

  if (existing.status === 'cancelado') await setOrderStatus(orderId, 'pendiente')
  const updated = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: { not: 'pagado' } },
    data: { paymentStatus: 'pagado', paymentMethod: method, paidAt: new Date() },
  })
  const order = toOrder(await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } }))
  if (updated.count > 0) {
    await tellCustomer(order, `¡Pago recibido! 🙌 Tu pedido de ${formatPrice(order.total)} ya entró a cocina. Te avisamos cuando esté listo.`)
  }
  return order
}

/** Anula los pedidos que vencieron sin pago y devuelve el stock. Se llama al leer pedidos y la cola de cocina. */
export async function expireUnpaidOrders(businessId: string): Promise<number> {
  const due = await prisma.order.findMany({
    where: { businessId, status: 'pendiente', paymentStatus: 'esperando', paymentDeadline: { lt: new Date() } },
    select: { id: true },
  })
  for (const { id } of due) {
    // Solo si sigue esperando: si justo se pagó, no se toca.
    const claimed = await prisma.order.updateMany({
      where: { id, paymentStatus: 'esperando' },
      data: { paymentStatus: 'vencido' },
    })
    if (claimed.count === 0) continue
    const order = await setOrderStatus(id, 'cancelado')
    await tellCustomer(
      order,
      'Anulamos tu pedido porque no alcanzó a llegar el pago en el plazo 🙏 Si todavía lo quieres, escríbenos y lo armamos de nuevo al tiro.',
    )
  }
  return due.length
}

/** Pedidos para la pantalla de cocina: los listos para preparar (pagados, o sin cobro previo). */
export async function listKitchenOrders(businessId: string): Promise<Order[]> {
  await expireUnpaidOrders(businessId)
  const since = new Date(Date.now() - 24 * 60 * 60_000)
  const rows = await prisma.order.findMany({
    where: { businessId, status: 'pendiente', paymentStatus: { in: ['pagado', 'no_aplica'] }, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    include: { items: true },
  })
  return rows.map(toOrder)
}

export async function markKitchenPrinted(businessId: string, orderId: string): Promise<boolean> {
  const res = await prisma.order.updateMany({
    where: { id: orderId, businessId, kitchenPrintedAt: null },
    data: { kitchenPrintedAt: new Date() },
  })
  return res.count > 0
}

/**
 * Después de un pedido: avisa al local los productos que cruzaron el mínimo
 * con este pedido (no en cada pedido mientras sigan bajos, para no saturar).
 */
export async function alertLowStock(
  businessId: string,
  businessName: string,
  items: { productId: string; quantity: number }[],
): Promise<string[]> {
  const settings = await getSalesSettings(businessId)
  if (!settings.stockAlertsEnabled || items.length === 0) return []
  const products = await prisma.product.findMany({
    where: { businessId, id: { in: items.map((i) => i.productId) }, stock: { not: null } },
  })
  const lines: string[] = []
  for (const p of products) {
    const sold = items.find((i) => i.productId === p.id)?.quantity ?? 0
    const now = p.stock ?? 0
    const before = now + sold
    if (now <= 0 && before > 0) lines.push(`${p.name}: se agotó`)
    else if (now <= settings.stockAlertThreshold && before > settings.stockAlertThreshold) lines.push(`${p.name}: quedan ${now}`)
  }
  await notifyStockAlert(businessId, businessName, lines).catch((error) =>
    console.error('[inventario] no se pudo avisar el stock bajo:', error),
  )
  return lines
}

/** Le escribe al cliente por su canal y deja el mensaje en la conversación. Best-effort. */
async function tellCustomer(order: Order, text: string): Promise<void> {
  if (!order.conversationId) return
  try {
    const [conversation, business] = await Promise.all([getConversation(order.conversationId), getBusiness(order.businessId)])
    if (!conversation || !business) return
    const credentials = decryptCredentials(business.credentials)
    if (conversation.channel === 'whatsapp') await sendWhatsAppMessage(conversation.contactHandle, text, credentials)
    else if (conversation.channel === 'instagram') await sendInstagramMessage(conversation.contactHandle, text, credentials)
    await appendMessage(conversation.id, { sender: 'agent', text })
  } catch (error) {
    console.error('[pagos] no se pudo avisar al cliente:', error)
  }
}
