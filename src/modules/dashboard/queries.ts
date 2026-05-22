import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/client'
import type { ComplianceByArea, ComplianceByCompany, CriticalRisk, PendingApprovalItem } from './types'

type BaseWhere = Prisma.DocumentWhereInput

// ── complianceByArea ──────────────────────────────────────────────────────────

export async function queryComplianceByArea(baseWhere: BaseWhere): Promise<ComplianceByArea[]> {
  const groups = await prisma.document.groupBy({
    by: ['workArea', 'status'],
    where: baseWhere,
    _count: { id: true },
  })

  const areaMap = new Map<string, { total: number; approved: number }>()
  for (const g of groups) {
    const key = g.workArea || 'Sin área'
    const entry = areaMap.get(key) ?? { total: 0, approved: 0 }
    entry.total += g._count.id
    if (g.status === 'APPROVED') entry.approved += g._count.id
    areaMap.set(key, entry)
  }

  return [...areaMap.entries()]
    .map(([area, v]) => ({
      area,
      total: v.total,
      approved: v.approved,
      rate: v.total > 0 ? Math.round((v.approved / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
}

// ── complianceByCompany ───────────────────────────────────────────────────────

export async function queryComplianceByCompany(
  baseWhere: BaseWhere,
  companies: { id: string; name: string }[]
): Promise<ComplianceByCompany[]> {
  const groups = await prisma.document.groupBy({
    by: ['companyId', 'status'],
    where: baseWhere,
    _count: { id: true },
  })

  const nameMap = new Map(companies.map((c) => [c.id, c.name]))
  const companyMap = new Map<string, { total: number; approved: number; rejected: number; observed: number }>()

  for (const g of groups) {
    const entry = companyMap.get(g.companyId) ?? { total: 0, approved: 0, rejected: 0, observed: 0 }
    entry.total += g._count.id
    if (g.status === 'APPROVED') entry.approved += g._count.id
    if (g.status === 'REJECTED') entry.rejected += g._count.id
    if (g.status === 'OBSERVED') entry.observed += g._count.id
    companyMap.set(g.companyId, entry)
  }

  return [...companyMap.entries()]
    .map(([companyId, v]) => ({
      companyId,
      companyName: nameMap.get(companyId) ?? companyId,
      total: v.total,
      approved: v.approved,
      rejected: v.rejected,
      observed: v.observed,
      rate: v.total > 0 ? Math.round((v.approved / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.rate - a.rate)
}

// ── byType ────────────────────────────────────────────────────────────────────

export async function queryByType(baseWhere: BaseWhere): Promise<{ type: string; count: number }[]> {
  const groups = await prisma.document.groupBy({
    by: ['type'],
    where: baseWhere,
    _count: { id: true },
  })

  return groups
    .map((g) => ({ type: g.type, count: g._count.id }))
    .sort((a, b) => b.count - a.count)
}

// ── docsWithoutSignature ──────────────────────────────────────────────────────

export async function queryDocsWithoutSignature(baseWhere: BaseWhere): Promise<number> {
  return prisma.document.count({
    where: {
      ...baseWhere,
      status: { notIn: ['DRAFT', 'ARCHIVED'] },
      signatures: { none: {} },
    },
  })
}

// ── criticalRisks + topErrors (bounded scan) ──────────────────────────────────
// Scans at most 100 non-resolved docs with a validationResult.

export async function queryCriticalAndErrors(baseWhere: BaseWhere): Promise<{
  risks: CriticalRisk[]
  topErrors: { issue: string; count: number }[]
}> {
  const docs = await prisma.document.findMany({
    where: {
      ...baseWhere,
      status: { notIn: ['APPROVED', 'CLOSED', 'ARCHIVED'] },
      validationResult: { not: Prisma.JsonNull },
    },
    select: {
      id: true,
      folio: true,
      type: true,
      workArea: true,
      validationResult: true,
      company: { select: { name: true } },
    },
    take: 100,
    orderBy: { createdAt: 'desc' },
  })

  const errorFreq = new Map<string, number>()
  const risks: CriticalRisk[] = []

  for (const d of docs) {
    const vr = d.validationResult as Record<string, unknown> | null
    const issues = (vr?.blockingIssues as string[] | undefined) ?? []
    if (issues.length === 0) continue

    for (const issue of issues) {
      errorFreq.set(issue, (errorFreq.get(issue) ?? 0) + 1)
    }
    if (risks.length < 20) {
      risks.push({
        documentId: d.id,
        folio: d.folio,
        type: d.type,
        workArea: d.workArea,
        companyName: d.company.name,
        blockingIssues: issues,
      })
    }
  }

  const topErrors = [...errorFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([issue, count]) => ({ issue, count }))

  return { risks, topErrors }
}

// ── pendingApprovals (cursor pagination) ──────────────────────────────────────

export async function queryPendingApprovals(params: {
  rangeFrom: Date
  rangeTo: Date
  canViewAll: boolean
  userCompanyId: string
  companyId?: string
  workArea?: string
  cursor?: string
  take: number
}): Promise<{ items: PendingApprovalItem[]; nextCursor: string | null; hasMore: boolean }> {
  const docWhere: Prisma.DocumentWhereInput = {
    status: 'PENDING_APPROVAL',
    createdAt: { gte: params.rangeFrom, lte: params.rangeTo },
    ...(params.canViewAll ? {} : { companyId: params.userCompanyId }),
    ...(params.companyId ? { companyId: params.companyId } : {}),
    ...(params.workArea ? { workArea: params.workArea } : {}),
  }

  const rows = await prisma.approval.findMany({
    where: { status: 'PENDING', document: docWhere },
    include: {
      document: {
        select: {
          id: true,
          folio: true,
          taskName: true,
          workArea: true,
          type: true,
          createdAt: true,
          company: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
      },
    },
    orderBy: { document: { createdAt: 'asc' } },
    take: params.take + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  })

  const hasMore = rows.length > params.take
  const items: PendingApprovalItem[] = rows.slice(0, params.take).map((a) => ({
    approvalId: a.id,
    documentId: a.document.id,
    folio: a.document.folio,
    taskName: a.document.taskName,
    workArea: a.document.workArea,
    type: a.document.type,
    requiredRole: a.role,
    companyName: a.document.company.name,
    createdByName: a.document.createdBy.name,
    createdAt: a.document.createdAt.toISOString(),
    waitingHours: Math.round(((Date.now() - a.document.createdAt.getTime()) / 3_600_000) * 10) / 10,
  }))

  const nextCursor = hasMore ? (items[items.length - 1]?.approvalId ?? null) : null

  return { items, nextCursor, hasMore }
}
