import { Prisma } from './generated/prisma/client'
import { afterCursor, paginate, type Page } from './apiV1'
import { prisma } from './db'
import { providerStatus } from './llm'
import { INCIDENT_SEVERITIES, INCIDENT_SOURCES } from './incidents'
import { comparePlans, PLAN_MONTHLY_CLP, PLAN_LABEL, isPaidPlan, type PlanName } from './plans'
import { getMaintenance } from './platform'
import { startOfBusinessDay, startOfBusinessMonth, businessTimezone } from './timezone'
import { monthlyLimit } from './planLimits'
import { startOfMonth } from './usage'

/**
 * Lo que devuelve la API v1. Cada función arma sus objetos campo por campo: no
 * se copian filas de la base. Así lo que no está escrito acá (contraseñas,
 * tokens de WhatsApp o Instagram, claves de Stripe, notas internas, el texto de
 * las conversaciones con los clientes finales) no puede salir por descuido.
 */

const iso = (d: Date | null | undefined) => d?.toISOString() ?? null
const isDemoNotes = (notes: string) => /demo/i.test(notes)

export const SUBSCRIPTION_STATUSES = ['activa', 'vencida', 'cancelada'] as const
export const INVOICE_STATUSES = ['pagada', 'pendiente', 'vencida', 'anulada'] as const
export const PAYMENT_STATUSES = ['pagado'] as const

// ---------------------------------------------------------------------------
// Clientes

type BusinessRow = Prisma.BusinessGetPayload<{
  select: {
    id: true
    businessName: true
    agentName: true
    industry: true
    templateId: true
    rut: true
    createdAt: true
    adminNotes: true
    whatsappPhoneNumberId: true
    instagramPageId: true
    setupFeePaidAt: true
    replyLimitOverride: true
    members: { select: { user: { select: { plan: true } } } }
  }
}>

const BUSINESS_SELECT = {
  id: true,
  businessName: true,
  agentName: true,
  industry: true,
  templateId: true,
  rut: true,
  createdAt: true,
  adminNotes: true,
  whatsappPhoneNumberId: true,
  instagramPageId: true,
  setupFeePaidAt: true,
  replyLimitOverride: true,
  members: { where: { role: 'OWNER' as const }, select: { user: { select: { plan: true } } } },
} satisfies Prisma.BusinessSelect

/** Plan de la empresa = el mejor plan entre sus dueños (igual que el cupo del agente). Sin dueños: administrada por la plataforma. */
function planOf(b: BusinessRow): PlanName {
  if (b.members.length === 0) return 'ILIMITADO'
  return b.members.reduce<PlanName>((best, m) => (comparePlans(m.user.plan, best) > 0 ? m.user.plan : best), 'FREE')
}

export function serializeClient(b: BusinessRow) {
  const whatsapp = Boolean(b.whatsappPhoneNumberId)
  const instagram = Boolean(b.instagramPageId)
  const plan = planOf(b)
  return {
    id: b.id,
    name: b.businessName,
    industry: b.industry,
    rut: b.rut,
    plan,
    planLabel: PLAN_LABEL[plan],
    status: whatsapp || instagram ? 'activo' : 'en_implementacion',
    isDemo: isDemoNotes(b.adminNotes),
    createdAt: b.createdAt.toISOString(),
    channels: { whatsapp, instagram },
    setupFeePaid: Boolean(b.setupFeePaidAt),
  }
}

export async function listClients(page: Page, opts: { includeDemo: boolean }) {
  const rows = await prisma.business.findMany({
    where: { ...(opts.includeDemo ? {} : { NOT: { adminNotes: { contains: 'demo', mode: 'insensitive' } } }), ...afterCursor('createdAt', page.cursor) },
    select: BUSINESS_SELECT,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: page.limit + 1,
  })
  const p = paginate(rows, page.limit, (r) => r.createdAt)
  return { data: p.data.map(serializeClient), page: p.page }
}

export async function getClient(id: string) {
  const row = await prisma.business.findUnique({ where: { id }, select: BUSINESS_SELECT })
  return row ? serializeClient(row) : null
}

// ---------------------------------------------------------------------------
// Bots

export type BotState = 'operativo' | 'degradado' | 'detenido' | 'sin_canal'

/** Última actividad y respuestas del mes por empresa, en una sola consulta cada una. */
async function activityFor(businessIds: string[], now: Date) {
  const empty = { lastMessageAt: new Map<string, Date>(), lastAgentReplyAt: new Map<string, Date>(), replies: new Map<string, number>() }
  if (businessIds.length === 0) return empty
  const ids = Prisma.join(businessIds)
  const [last, replies] = await Promise.all([
    prisma.$queryRaw<{ businessId: string; lastMessage: Date | null; lastAgent: Date | null }[]>(Prisma.sql`
      SELECT c."businessId" AS "businessId", max(m."timestamp") AS "lastMessage",
             max(m."timestamp") FILTER (WHERE m.sender = 'agent') AS "lastAgent"
      FROM messages m JOIN conversations c ON c.id = m."conversationId"
      WHERE c."businessId" IN (${ids})
      GROUP BY c."businessId"`),
    prisma.$queryRaw<{ businessId: string; n: bigint }[]>(Prisma.sql`
      SELECT c."businessId" AS "businessId", count(*) AS n
      FROM messages m JOIN conversations c ON c.id = m."conversationId"
      WHERE c."businessId" IN (${ids}) AND m.sender = 'agent' AND m."timestamp" >= ${startOfMonth(now)}
      GROUP BY c."businessId"`),
  ])
  for (const r of last) {
    if (r.lastMessage) empty.lastMessageAt.set(r.businessId, r.lastMessage)
    if (r.lastAgent) empty.lastAgentReplyAt.set(r.businessId, r.lastAgent)
  }
  for (const r of replies) empty.replies.set(r.businessId, Number(r.n))
  return empty
}

async function recentIncidentCounts(businessIds: string[], since: Date) {
  const map = new Map<string, number>()
  if (businessIds.length === 0) return map
  const rows = await prisma.incident.groupBy({
    by: ['businessId'],
    where: { businessId: { in: businessIds }, occurredAt: { gte: since } },
    _count: { _all: true },
  })
  for (const r of rows) if (r.businessId) map.set(r.businessId, r._count._all)
  return map
}

async function botsFor(rows: BusinessRow[], now: Date) {
  const ids = rows.map((r) => r.id)
  const [maintenance, activity, errors] = await Promise.all([
    getMaintenance(),
    activityFor(ids, now),
    recentIncidentCounts(ids, new Date(now.getTime() - 24 * 3_600_000)),
  ])
  const aiConfigured = providerStatus().configured

  return rows.map((b) => {
    const client = serializeClient(b)
    const plan = planOf(b)
    const limit = b.replyLimitOverride ?? monthlyLimit(plan)
    const used = activity.replies.get(b.id) ?? 0
    const errors24h = errors.get(b.id) ?? 0
    const reasons: string[] = []
    if (!client.channels.whatsapp && !client.channels.instagram) reasons.push('sin_canal')
    else {
      if (maintenance.enabled) reasons.push('mantenimiento')
      if (!aiConfigured) reasons.push('ia_no_configurada')
      if (limit !== null && used >= limit) reasons.push('cupo_agotado')
      if (errors24h > 0 && reasons.length === 0) reasons.push('errores_recientes')
    }
    const state: BotState = reasons.includes('sin_canal')
      ? 'sin_canal'
      : reasons.some((r) => r !== 'errores_recientes')
        ? 'detenido'
        : reasons.length > 0
          ? 'degradado'
          : 'operativo'
    return {
      id: b.id,
      clientId: b.id,
      name: b.agentName,
      businessName: b.businessName,
      isDemo: client.isDemo,
      channels: client.channels,
      state,
      reasons,
      lastMessageAt: iso(activity.lastMessageAt.get(b.id)),
      lastAgentReplyAt: iso(activity.lastAgentReplyAt.get(b.id)),
      repliesThisMonth: used,
      monthlyReplyLimit: limit,
      errorsLast24h: errors24h,
    }
  })
}

export async function listBots(page: Page, opts: { includeDemo: boolean }, now = new Date()) {
  const rows = await prisma.business.findMany({
    where: { ...(opts.includeDemo ? {} : { NOT: { adminNotes: { contains: 'demo', mode: 'insensitive' } } }), ...afterCursor('createdAt', page.cursor) },
    select: BUSINESS_SELECT,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: page.limit + 1,
  })
  const p = paginate(rows, page.limit, (r) => r.createdAt)
  return { data: await botsFor(p.data, now), page: p.page }
}

export async function getBotStatus(id: string, now = new Date()) {
  const row = await prisma.business.findUnique({ where: { id }, select: BUSINESS_SELECT })
  if (!row) return null
  const [bot] = await botsFor([row], now)
  const incidents = await prisma.incident.findMany({
    where: { businessId: id, occurredAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: 10,
  })
  return { ...bot, checkedAt: now.toISOString(), recentErrors: incidents.map(serializeIncident) }
}

// ---------------------------------------------------------------------------
// Resumen de métricas

/**
 * Mediana de segundos entre un mensaje del cliente y la respuesta del agente
 * (solo pares seguidos, de menos de una hora: una respuesta que llega tras
 * horas fue una persona o un reintento, no la velocidad del agente). Sin el
 * simulador. `businessId` acota a un negocio.
 */
export async function responseTimeStats(since: Date, businessId?: string) {
  const scope = businessId ? Prisma.sql`AND c."businessId" = ${businessId}` : Prisma.empty
  const rows = await prisma.$queryRaw<{ median: number | null; n: bigint }[]>(Prisma.sql`
    WITH ordered AS (
      SELECT m.sender, m."timestamp" AS ts,
             LAG(m.sender) OVER w AS prev_sender, LAG(m."timestamp") OVER w AS prev_ts
      FROM messages m JOIN conversations c ON c.id = m."conversationId"
      WHERE c.channel <> 'simulador' AND m."timestamp" >= ${since} ${scope}
      WINDOW w AS (PARTITION BY m."conversationId" ORDER BY m."timestamp")
    )
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (ts - prev_ts))) AS median, count(*) AS n
    FROM ordered
    WHERE sender = 'agent' AND prev_sender = 'contact' AND ts - prev_ts < interval '1 hour'`)
  const r = rows[0]
  return { medianSeconds: r?.median != null ? Math.round(r.median * 10) / 10 : null, sampleSize: Number(r?.n ?? 0), windowDays: 30 }
}

export async function metricsSummary(now = new Date()) {
  const dayStart = startOfBusinessDay(now)
  const monthStart = startOfBusinessMonth(now)
  const since24h = new Date(now.getTime() - 24 * 3_600_000)
  const since30d = new Date(now.getTime() - 30 * 86_400_000)
  const real = { conversation: { channel: { not: 'simulador' } } }

  const [businesses, today, month, replies24h, errors24h, responseTime] = await Promise.all([
    prisma.business.findMany({ select: BUSINESS_SELECT }),
    prisma.message.groupBy({ by: ['sender'], where: { timestamp: { gte: dayStart }, ...real }, _count: { _all: true } }),
    prisma.message.groupBy({ by: ['sender'], where: { timestamp: { gte: monthStart }, ...real }, _count: { _all: true } }),
    prisma.message.count({ where: { sender: 'agent', timestamp: { gte: since24h }, ...real } }),
    prisma.incident.count({ where: { occurredAt: { gte: since24h }, source: { in: ['ia', 'whatsapp', 'instagram'] } } }),
    responseTimeStats(since30d),
  ])

  const bots = await botsFor(businesses, now)
  const customers = businesses.filter((b) => !isDemoNotes(b.adminNotes))
  const count = (rows: { sender: string; _count: { _all: number } }[], sender?: string) =>
    rows.filter((r) => !sender || r.sender === sender).reduce((n, r) => n + r._count._all, 0)
  const messageBlock = (rows: { sender: string; _count: { _all: number } }[]) => ({
    total: count(rows),
    fromContacts: count(rows, 'contact'),
    fromAgent: count(rows, 'agent'),
    fromHumans: count(rows, 'human'),
  })
  const attempts = replies24h + errors24h

  return {
    generatedAt: now.toISOString(),
    timezone: businessTimezone(),
    clients: {
      total: customers.length,
      active: customers.filter((b) => b.whatsappPhoneNumberId || b.instagramPageId).length,
      inImplementation: customers.filter((b) => !b.whatsappPhoneNumberId && !b.instagramPageId).length,
    },
    bots: {
      total: bots.length,
      live: bots.filter((b) => b.state === 'operativo' || b.state === 'degradado').length,
      operational: bots.filter((b) => b.state === 'operativo').length,
      degraded: bots.filter((b) => b.state === 'degradado').length,
      stopped: bots.filter((b) => b.state === 'detenido').length,
      withoutChannel: bots.filter((b) => b.state === 'sin_canal').length,
    },
    messages: { today: messageBlock(today), month: messageBlock(month), excludes: 'simulador' },
    responseTime,
    errors: { last24h: errors24h, rateLast24h: attempts > 0 ? Math.round((errors24h / attempts) * 10_000) / 10_000 : 0, agentReplies24h: replies24h },
  }
}

// ---------------------------------------------------------------------------
// Suscripciones

/** Negocios de cada usuario, para mostrar de qué cliente es una suscripción, un pago o una factura. */
async function clientsOfUsers(userIds: string[]) {
  const map = new Map<string, { id: string; name: string }[]>()
  if (userIds.length === 0) return map
  const rows = await prisma.businessMember.findMany({
    where: { userId: { in: userIds }, role: 'OWNER' },
    select: { userId: true, business: { select: { id: true, businessName: true } } },
    orderBy: { createdAt: 'asc' },
  })
  for (const r of rows) map.set(r.userId, [...(map.get(r.userId) ?? []), { id: r.business.id, name: r.business.businessName }])
  return map
}

function subscriptionState(status: string): (typeof SUBSCRIPTION_STATUSES)[number] {
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete_expired') return 'vencida'
  if (status === 'canceled' || status === 'incomplete') return 'cancelada'
  return 'activa'
}

export async function listSubscriptions(page: Page, now = new Date()) {
  const users = await prisma.user.findMany({
    where: {
      role: 'USER',
      OR: [{ plan: { not: 'FREE' } }, { subscriptions: { some: {} } }],
      ...afterCursor('createdAt', page.cursor),
    },
    select: {
      id: true,
      plan: true,
      createdAt: true,
      stripeSubscriptionId: true,
      subscriptions: { orderBy: { updatedAt: 'desc' }, take: 1 },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: page.limit + 1,
  })
  const p = paginate(users, page.limit, (u) => u.createdAt)
  const clients = await clientsOfUsers(p.data.map((u) => u.id))

  const data = p.data.map((u) => {
    const sub = u.subscriptions[0]
    const clientsOfUser = clients.get(u.id) ?? []
    if (sub) {
      const status = subscriptionState(sub.status)
      const daysPastDue = status === 'vencida' && sub.pastDueSince ? Math.max(0, Math.floor((now.getTime() - sub.pastDueSince.getTime()) / 86_400_000)) : 0
      return {
        id: sub.id,
        clients: clientsOfUser,
        plan: sub.plan,
        planLabel: isPaidPlan(sub.plan) ? PLAN_LABEL[sub.plan] : sub.plan,
        amountClp: sub.amountClp,
        status,
        billing: 'stripe' as const,
        startedAt: sub.createdAt.toISOString(),
        nextChargeAt: status === 'activa' && !sub.canceledAt ? iso(sub.currentPeriodEnd) : null,
        canceledAt: iso(sub.canceledAt),
        daysPastDue,
      }
    }
    const plan = u.plan
    const stripe = Boolean(u.stripeSubscriptionId)
    return {
      id: stripe ? u.stripeSubscriptionId! : `cortesia_${u.id}`,
      clients: clientsOfUser,
      plan,
      planLabel: PLAN_LABEL[plan],
      // Plan dado a mano por el administrador, sin cobro de por medio.
      amountClp: stripe && isPaidPlan(plan) ? PLAN_MONTHLY_CLP[plan] : 0,
      status: 'activa' as const,
      billing: stripe ? ('stripe' as const) : ('cortesia' as const),
      startedAt: u.createdAt.toISOString(),
      nextChargeAt: null,
      canceledAt: null,
      daysPastDue: 0,
    }
  })
  return { data, page: p.page }
}

// ---------------------------------------------------------------------------
// Pagos y facturas

export async function listPayments(page: Page, opts: { from: Date | null; to: Date | null; status: string | null }) {
  const rows = await prisma.payment.findMany({
    where: {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.from || opts.to ? { paidAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {}),
      ...afterCursor('paidAt', page.cursor),
    },
    orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
    take: page.limit + 1,
  })
  const p = paginate(rows, page.limit, (r) => r.paidAt)
  const [clients, invoices] = await Promise.all([
    clientsOfUsers(p.data.flatMap((r) => (r.userId ? [r.userId] : []))),
    prisma.invoice.findMany({ where: { stripeInvoiceId: { in: p.data.map((r) => r.stripeInvoiceId) } }, select: { id: true, stripeInvoiceId: true } }),
  ])
  const invoiceOf = new Map(invoices.map((i) => [i.stripeInvoiceId, i.id]))
  return {
    data: p.data.map((r) => ({
      id: r.id,
      clients: r.userId ? (clients.get(r.userId) ?? []) : [],
      amountClp: r.amountClp,
      method: r.method,
      status: r.status,
      paidAt: r.paidAt.toISOString(),
      invoiceId: invoiceOf.get(r.stripeInvoiceId) ?? null,
    })),
    page: p.page,
  }
}

export async function listInvoices(page: Page, opts: { from: Date | null; to: Date | null }, now = new Date()) {
  const rows = await prisma.invoice.findMany({
    where: {
      ...(opts.from || opts.to ? { issuedAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {}),
      ...afterCursor('issuedAt', page.cursor),
    },
    orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
    take: page.limit + 1,
  })
  const p = paginate(rows, page.limit, (r) => r.issuedAt)
  const clients = await clientsOfUsers(p.data.flatMap((r) => (r.userId ? [r.userId] : [])))
  const data = p.data.map((r) => {
    // Una factura pendiente cuyo plazo pasó es "vencida" aunque nadie lo haya anotado todavía.
    const status = r.status === 'pendiente' && r.dueDate && r.dueDate < now ? 'vencida' : (r.status as (typeof INVOICE_STATUSES)[number])
    return {
      id: r.id,
      number: r.number,
      folio: r.folio,
      siiStatus: r.siiStatus,
      clients: r.userId ? (clients.get(r.userId) ?? []) : [],
      amountClp: r.amountClp,
      status,
      paid: status === 'pagada',
      issuedAt: r.issuedAt.toISOString(),
      dueDate: iso(r.dueDate),
      paidAt: iso(r.paidAt),
    }
  })
  return { data, page: p.page }
}

// ---------------------------------------------------------------------------
// Incidentes

export function serializeIncident(r: { id: string; source: string; severity: string; code: string; message: string; businessId: string | null; occurredAt: Date }) {
  return {
    id: r.id,
    source: r.source,
    severity: r.severity,
    code: r.code,
    message: r.message,
    clientId: r.businessId,
    occurredAt: r.occurredAt.toISOString(),
  }
}

export async function listIncidents(
  page: Page,
  opts: { from: Date | null; to: Date | null; severity: string | null; source: string | null },
) {
  const rows = await prisma.incident.findMany({
    where: {
      ...(opts.severity ? { severity: opts.severity } : {}),
      ...(opts.source ? { source: opts.source } : {}),
      ...(opts.from || opts.to ? { occurredAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {}),
      ...afterCursor('occurredAt', page.cursor),
    },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: page.limit + 1,
  })
  const p = paginate(rows, page.limit, (r) => r.occurredAt)
  return { data: p.data.map(serializeIncident), page: p.page }
}

export { INCIDENT_SEVERITIES, INCIDENT_SOURCES }
