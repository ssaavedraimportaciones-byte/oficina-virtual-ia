import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/client'
import { canAccess } from '@/lib/permissions'
import { InMemoryCache } from './cache'
import type { CacheStore } from './cache'
import {
  queryComplianceByArea,
  queryComplianceByCompany,
  queryByType,
  queryDocsWithoutSignature,
  queryCriticalAndErrors,
  queryPendingApprovals,
} from './queries'
import type { DashboardFilters, DashboardStats } from './types'
import type { UserRole } from '@/types/user'

export { buildCacheKey, InMemoryCache, DASHBOARD_TTL_MS } from './cache'
export type { DashboardFilters, DashboardStats } from './types'
export { dashboardFiltersSchema } from './types'

function createDashboardCache(): CacheStore<DashboardStats> {
  if (process.env.CACHE_PROVIDER === 'redis') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RedisCache } = require('./redis-cache') as typeof import('./redis-cache')
    return new RedisCache<DashboardStats>()
  }
  return new InMemoryCache<DashboardStats>()
}

export const dashboardCache = createDashboardCache()

// ── helpers ───────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

// ── loadDashboardStats ────────────────────────────────────────────────────────

export async function loadDashboardStats(
  filters: DashboardFilters,
  user: { uid: string; role: string; companyId: string }
): Promise<DashboardStats> {
  const now = new Date()
  const rangeFrom = filters.dateFrom
    ? startOfDay(new Date(filters.dateFrom))
    : startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
  const rangeTo = filters.dateTo ? endOfDay(new Date(filters.dateTo)) : endOfDay(now)

  const canViewAll = canAccess(user.role as UserRole, 'documents:view_all')

  const baseWhere: Prisma.DocumentWhereInput = {
    createdAt: { gte: rangeFrom, lte: rangeTo },
    ...(filters.companyId
      ? { companyId: filters.companyId }
      : canViewAll ? {} : { companyId: user.companyId }),
    ...(filters.workArea  ? { workArea: filters.workArea }         : {}),
    ...(filters.docType   ? { type: filters.docType }              : {}),
    ...(filters.status    ? { status: filters.status }             : {}),
    ...(filters.createdBy ? { createdById: filters.createdBy }     : {}),
    ...(user.role === 'WORKER' ? { createdById: user.uid }         : {}),
  }

  const today = startOfDay(now)
  const todayWhere: Prisma.DocumentWhereInput = {
    ...baseWhere,
    createdAt: { gte: today, lte: endOfDay(now) },
  }

  // ── Phase 1: independent count + company queries ───────────────────────────
  const [
    createdToday,
    approvedCount,
    rejectedCount,
    observedCount,
    pendingSignatureCount,
    pendingApprovalCount,
    totalCount,
    docsWithoutSignature,
    approvalTimes,
    companiesRaw,
  ] = await Promise.all([
    prisma.document.count({ where: todayWhere }),
    prisma.document.count({ where: { ...baseWhere, status: 'APPROVED' } }),
    prisma.document.count({ where: { ...baseWhere, status: 'REJECTED' } }),
    prisma.document.count({ where: { ...baseWhere, status: 'OBSERVED' } }),
    prisma.document.count({ where: { ...baseWhere, status: 'PENDING_SIGNATURE' } }),
    prisma.document.count({ where: { ...baseWhere, status: 'PENDING_APPROVAL' } }),
    prisma.document.count({ where: baseWhere }),
    queryDocsWithoutSignature(baseWhere),
    prisma.approval.findMany({
      where: {
        status: 'APPROVED',
        approvedAt: { not: null },
        document: { createdAt: { gte: rangeFrom, lte: rangeTo } },
      },
      select: {
        approvedAt: true,
        document: { select: { createdAt: true } },
      },
      take: 500,
    }),
    prisma.company.findMany({
      where: canViewAll ? {} : { id: user.companyId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // ── Phase 2: aggregation queries (need companiesRaw for company names) ─────
  const [complianceByArea, complianceByCompany, byType, criticalAndErrors, pendingApprovals] =
    await Promise.all([
      queryComplianceByArea(baseWhere),
      queryComplianceByCompany(baseWhere, companiesRaw),
      queryByType(baseWhere),
      queryCriticalAndErrors(baseWhere),
      queryPendingApprovals({
        rangeFrom,
        rangeTo,
        canViewAll,
        userCompanyId: user.companyId,
        companyId: filters.companyId,
        workArea: filters.workArea,
        cursor: filters.cursor,
        take: filters.take,
      }),
    ])

  // ── Average approval time ─────────────────────────────────────────────────
  let avgApprovalHours: number | null = null
  if (approvalTimes.length > 0) {
    const totalMs = approvalTimes.reduce(
      (sum, a) => (a.approvedAt ? sum + (a.approvedAt.getTime() - a.document.createdAt.getTime()) : sum),
      0
    )
    avgApprovalHours = Math.round((totalMs / approvalTimes.length / 1000 / 3600) * 10) / 10
  }

  return {
    kpis: {
      createdToday,
      approved: approvedCount,
      rejected: rejectedCount,
      observed: observedCount,
      pendingSignature: pendingSignatureCount,
      pendingApproval: pendingApprovalCount,
      docsWithoutSignature,
      avgApprovalHours,
      criticalRisksCount: criticalAndErrors.risks.length,
      total: totalCount,
    },
    complianceByArea,
    complianceByCompany,
    topErrors: criticalAndErrors.topErrors,
    criticalRisks: criticalAndErrors.risks,
    byType,
    pendingApprovals,
    companies: companiesRaw,
    filters: { dateFrom: rangeFrom.toISOString(), dateTo: rangeTo.toISOString() },
  }
}
