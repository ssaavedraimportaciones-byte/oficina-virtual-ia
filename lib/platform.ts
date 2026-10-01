import { prisma } from './db'
import { getAgentUsage, monthlyLimit, type AgentUsage } from './usage'

/**
 * Lo que solo ve y toca el dueño de la plataforma: modo mantenimiento, avisos a
 * los clientes, notas internas y límites por empresa, y la vista de cobros.
 * Nada de esto pasa por `Business` ni por `toPublicBusiness`, a propósito: lo
 * que el mapper nunca devuelve no puede filtrarse al panel de una empresa.
 */

// --- Modo mantenimiento ---

export const DEFAULT_MAINTENANCE_REPLY =
  'Estamos haciendo mejoras en el sistema y no podemos responder de forma automática ahora. Una persona del equipo te va a contestar lo antes posible.'

const KEY_MAINTENANCE_ON = 'maintenance_mode'
const KEY_MAINTENANCE_REPLY = 'maintenance_reply'

export interface Maintenance {
  enabled: boolean
  /** Lo que reciben los clientes finales mientras el agente está apagado o falla la IA. */
  message: string
}

export async function getMaintenance(): Promise<Maintenance> {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: [KEY_MAINTENANCE_ON, KEY_MAINTENANCE_REPLY] } },
  })
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return {
    enabled: byKey[KEY_MAINTENANCE_ON] === 'true',
    message: byKey[KEY_MAINTENANCE_REPLY]?.trim() || DEFAULT_MAINTENANCE_REPLY,
  }
}

export async function setMaintenance(input: { enabled: boolean; message: string }): Promise<Maintenance> {
  const upsert = (key: string, value: string) =>
    prisma.platformSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
  await prisma.$transaction([
    upsert(KEY_MAINTENANCE_ON, String(input.enabled)),
    upsert(KEY_MAINTENANCE_REPLY, input.message.trim()),
  ])
  return getMaintenance()
}

// --- Avisos a los clientes ---

export type AnnouncementLevel = 'info' | 'warning' | 'maintenance'

export interface AnnouncementItem {
  id: string
  message: string
  level: AnnouncementLevel
  active: boolean
  createdAt: string
}

function mapAnnouncement(row: { id: string; message: string; level: string; active: boolean; createdAt: Date }): AnnouncementItem {
  return {
    id: row.id,
    message: row.message,
    level: (['info', 'warning', 'maintenance'].includes(row.level) ? row.level : 'info') as AnnouncementLevel,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listAnnouncements(): Promise<AnnouncementItem[]> {
  const rows = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } })
  return rows.map(mapAnnouncement)
}

/** Los que ven los clientes en su panel. */
export async function listActiveAnnouncements(): Promise<AnnouncementItem[]> {
  const rows = await prisma.announcement.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' }, take: 5 })
  return rows.map(mapAnnouncement)
}

export async function createAnnouncement(input: { message: string; level: AnnouncementLevel }): Promise<AnnouncementItem> {
  return mapAnnouncement(await prisma.announcement.create({ data: { message: input.message.trim(), level: input.level } }))
}

export async function setAnnouncementActive(id: string, active: boolean): Promise<AnnouncementItem | null> {
  const row = await prisma.announcement.update({ where: { id }, data: { active } }).catch(() => null)
  return row ? mapAnnouncement(row) : null
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await prisma.announcement.delete({ where: { id } }).catch(() => {})
}

// --- Notas internas y límite por empresa ---

export interface BusinessAdminMeta {
  adminNotes: string
  replyLimitOverride: number | null
}

export async function getBusinessAdminMeta(businessId: string): Promise<BusinessAdminMeta | null> {
  const row = await prisma.business.findUnique({
    where: { id: businessId },
    select: { adminNotes: true, replyLimitOverride: true },
  })
  return row
}

export async function setBusinessAdminMeta(
  businessId: string,
  input: Partial<BusinessAdminMeta>,
): Promise<BusinessAdminMeta | null> {
  const row = await prisma.business
    .update({
      where: { id: businessId },
      data: {
        ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes } : {}),
        ...(input.replyLimitOverride !== undefined ? { replyLimitOverride: input.replyLimitOverride } : {}),
      },
      select: { adminNotes: true, replyLimitOverride: true },
    })
    .catch(() => null)
  return row
}

// --- Cobros ---

export interface BillingBusinessRow {
  businessId: string
  name: string
  usage: AgentUsage
  adminNotes: string
  replyLimitOverride: number | null
}

export interface BillingUserRow {
  id: string
  email: string
  role: 'PLATFORM_ADMIN' | 'USER'
  plan: 'FREE' | 'PRO'
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  /** PRO sin suscripción de Stripe: lo dio el administrador a mano. */
  courtesy: boolean
  businesses: BillingBusinessRow[]
  repliesThisMonth: number
}

export interface BillingOverview {
  users: BillingUserRow[]
  totals: {
    users: number
    pro: number
    free: number
    /** PRO con suscripción de Stripe: los que de verdad pagan. */
    paying: number
    courtesy: number
    repliesThisMonth: number
    businessesNearLimit: number
    businessesOverLimit: number
  }
}

export async function getBillingOverview(now: Date = new Date()): Promise<BillingOverview> {
  const rows = await prisma.user.findMany({
    orderBy: [{ plan: 'desc' }, { email: 'asc' }],
    include: {
      memberships: {
        where: { role: 'OWNER' },
        include: { business: { select: { id: true, businessName: true, adminNotes: true, replyLimitOverride: true } } },
      },
    },
  })

  const users: BillingUserRow[] = []
  for (const row of rows) {
    const businesses: BillingBusinessRow[] = []
    for (const membership of row.memberships) {
      businesses.push({
        businessId: membership.business.id,
        name: membership.business.businessName,
        usage: await getAgentUsage(membership.business.id, now),
        adminNotes: membership.business.adminNotes,
        replyLimitOverride: membership.business.replyLimitOverride,
      })
    }
    users.push({
      id: row.id,
      email: row.email,
      role: row.role,
      plan: row.plan,
      stripeCustomerId: row.stripeCustomerId,
      stripeSubscriptionId: row.stripeSubscriptionId,
      courtesy: row.plan === 'PRO' && !row.stripeSubscriptionId,
      businesses,
      repliesThisMonth: businesses.reduce((sum, b) => sum + b.usage.used, 0),
    })
  }

  const allBusinesses = users.flatMap((u) => u.businesses)
  return {
    users,
    totals: {
      users: users.length,
      pro: users.filter((u) => u.plan === 'PRO').length,
      free: users.filter((u) => u.plan === 'FREE').length,
      paying: users.filter((u) => u.plan === 'PRO' && u.stripeSubscriptionId).length,
      courtesy: users.filter((u) => u.courtesy).length,
      repliesThisMonth: users.reduce((sum, u) => sum + u.repliesThisMonth, 0),
      businessesNearLimit: allBusinesses.filter((b) => b.usage.limit !== null && !b.usage.exceeded && b.usage.used >= b.usage.limit * 0.8).length,
      businessesOverLimit: allBusinesses.filter((b) => b.usage.exceeded).length,
    },
  }
}

export async function setUserPlan(userId: string, plan: 'FREE' | 'PRO'): Promise<boolean> {
  const result = await prisma.user.updateMany({ where: { id: userId }, data: { plan } })
  return result.count > 0
}

export interface BusinessAdminRow {
  businessId: string
  name: string
  /** Vacío = la empresa no tiene dueños: la administra la plataforma. */
  ownerEmails: string[]
  plan: 'FREE' | 'PRO'
  used: number
  /** Límite que da el plan (`null` = sin límite). */
  planLimit: number | null
  replyLimitOverride: number | null
  adminNotes: string
}

/** Todas las empresas de la plataforma, con su consumo, su límite y las notas del propietario. */
export async function listBusinessAdminRows(now: Date = new Date()): Promise<BusinessAdminRow[]> {
  const rows = await prisma.business.findMany({
    orderBy: { businessName: 'asc' },
    select: {
      id: true,
      businessName: true,
      adminNotes: true,
      replyLimitOverride: true,
      members: { where: { role: 'OWNER' }, select: { user: { select: { email: true } } } },
    },
  })
  return Promise.all(
    rows.map(async (row) => {
      const usage = await getAgentUsage(row.id, now)
      return {
        businessId: row.id,
        name: row.businessName,
        ownerEmails: row.members.map((m) => m.user.email),
        plan: usage.plan,
        used: usage.used,
        planLimit: monthlyLimit(usage.plan),
        replyLimitOverride: row.replyLimitOverride,
        adminNotes: row.adminNotes,
      }
    }),
  )
}
