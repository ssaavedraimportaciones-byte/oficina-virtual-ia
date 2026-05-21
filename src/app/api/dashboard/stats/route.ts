import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { requirePermission } from '@/app/api/_lib/auth-middleware'
import { canAccess } from '@/lib/permissions'

// ─── helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

// ─── GET /api/dashboard/stats ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const result = requirePermission(req, 'dashboard:view')
  if ('error' in result) return result.error
  const { user } = result

  const { searchParams } = req.nextUrl
  const dateFrom   = searchParams.get('dateFrom')
  const dateTo     = searchParams.get('dateTo')
  const companyId  = searchParams.get('companyId')
  const workArea   = searchParams.get('workArea')
  const docType    = searchParams.get('docType')
  const status     = searchParams.get('status')
  const createdBy  = searchParams.get('createdBy')

  // ── Date range ──────────────────────────────────────────────────────────────
  const now = new Date()
  const rangeFrom = dateFrom ? startOfDay(new Date(dateFrom)) : startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
  const rangeTo   = dateTo   ? endOfDay(new Date(dateTo))     : endOfDay(now)

  // ── Base where clause (scope by role) ──────────────────────────────────────
  const canViewAll = canAccess(user.role, 'documents:view_all')

  const baseWhere: Record<string, unknown> = {
    createdAt: { gte: rangeFrom, lte: rangeTo },
    ...(companyId ? { companyId } : canViewAll ? {} : { companyId: user.companyId }),
    ...(workArea  ? { workArea }  : {}),
    ...(docType   ? { type: docType } : {}),
    ...(status    ? { status }    : {}),
    ...(createdBy ? { createdById: createdBy } : {}),
  }

  // WORKER sees only own documents
  if (user.role === 'WORKER') {
    baseWhere.createdById = user.uid
  }

  // ── Parallel queries ────────────────────────────────────────────────────────
  const today = startOfDay(now)
  const todayWhere = { ...baseWhere, createdAt: { gte: today, lte: endOfDay(now) } }

  const [
    createdToday,
    approvedCount,
    rejectedCount,
    observedCount,
    pendingSignatureCount,
    pendingApprovalCount,
    allDocs,
    approvalTimes,
    companiesRaw,
  ] = await Promise.all([
    // KPI cards
    prisma.document.count({ where: todayWhere }),
    prisma.document.count({ where: { ...baseWhere, status: 'APPROVED' } }),
    prisma.document.count({ where: { ...baseWhere, status: 'REJECTED' } }),
    prisma.document.count({ where: { ...baseWhere, status: 'OBSERVED' } }),
    prisma.document.count({ where: { ...baseWhere, status: 'PENDING_SIGNATURE' } }),
    prisma.document.count({ where: { ...baseWhere, status: 'PENDING_APPROVAL' } }),

    // All docs for compliance + area + risk breakdown
    prisma.document.findMany({
      where: baseWhere,
      select: {
        id: true,
        folio: true,
        status: true,
        workArea: true,
        type: true,
        validationResult: true,
        companyId: true,
        company: { select: { id: true, name: true } },
        signatures: { select: { id: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Average approval time — approvals that were decided
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

    // Companies for ranking
    prisma.company.findMany({
      where: canViewAll ? {} : { id: user.companyId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // ── Compliance by area ─────────────────────────────────────────────────────
  const areaMap = new Map<string, { total: number; approved: number }>()
  for (const d of allDocs) {
    const key = d.workArea || 'Sin área'
    const entry = areaMap.get(key) ?? { total: 0, approved: 0 }
    entry.total++
    if (d.status === 'APPROVED') entry.approved++
    areaMap.set(key, entry)
  }
  const complianceByArea = [...areaMap.entries()]
    .map(([area, v]) => ({
      area,
      total: v.total,
      approved: v.approved,
      rate: v.total > 0 ? Math.round((v.approved / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // ── Compliance by company ──────────────────────────────────────────────────
  const companyDocMap = new Map<string, { name: string; total: number; approved: number; rejected: number; observed: number }>()
  for (const d of allDocs) {
    const key = d.companyId
    const entry = companyDocMap.get(key) ?? { name: d.company.name, total: 0, approved: 0, rejected: 0, observed: 0 }
    entry.total++
    if (d.status === 'APPROVED') entry.approved++
    if (d.status === 'REJECTED') entry.rejected++
    if (d.status === 'OBSERVED') entry.observed++
    companyDocMap.set(key, entry)
  }
  const complianceByCompany = [...companyDocMap.entries()]
    .map(([companyId, v]) => ({
      companyId,
      companyName: v.name,
      total: v.total,
      approved: v.approved,
      rejected: v.rejected,
      observed: v.observed,
      rate: v.total > 0 ? Math.round((v.approved / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.rate - a.rate)

  // ── Documents without signatures ──────────────────────────────────────────
  const docsWithoutSignature = allDocs.filter(
    (d) => d.signatures.length === 0 && !['DRAFT', 'ARCHIVED'].includes(d.status)
  ).length

  // ── Average approval time (hours) ─────────────────────────────────────────
  let avgApprovalHours: number | null = null
  if (approvalTimes.length > 0) {
    const totalMs = approvalTimes.reduce((sum, a) => {
      if (!a.approvedAt) return sum
      return sum + (a.approvedAt.getTime() - a.document.createdAt.getTime())
    }, 0)
    avgApprovalHours = Math.round(totalMs / approvalTimes.length / 1000 / 3600 * 10) / 10
  }

  // ── Most frequent errors (blocking issues from rules engine) ──────────────
  const errorFreq = new Map<string, number>()
  for (const d of allDocs) {
    const vr = d.validationResult as Record<string, unknown> | null
    const issues = (vr?.blockingIssues as string[] | undefined) ?? []
    for (const issue of issues) {
      errorFreq.set(issue, (errorFreq.get(issue) ?? 0) + 1)
    }
  }
  const topErrors = [...errorFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([issue, count]) => ({ issue, count }))

  // ── Critical risks (docs with blocking issues, not yet resolved) ──────────
  const criticalRisks = allDocs
    .filter((d) => {
      const vr = d.validationResult as Record<string, unknown> | null
      const issues = (vr?.blockingIssues as string[] | undefined) ?? []
      return issues.length > 0 && !['APPROVED', 'CLOSED', 'ARCHIVED'].includes(d.status as string)
    })
    .slice(0, 20)
    .map((d) => {
      const vr = d.validationResult as Record<string, unknown> | null
      return {
        documentId: d.id,
        folio: d.folio,
        type: d.type,
        workArea: d.workArea,
        companyName: d.company.name,
        blockingIssues: (vr?.blockingIssues as string[] | undefined) ?? [],
      }
    })

  // ── Pending approvals detail ───────────────────────────────────────────────
  const pendingApprovals = await prisma.approval.findMany({
    where: {
      status: 'PENDING',
      document: {
        status: 'PENDING_APPROVAL',
        createdAt: { gte: rangeFrom, lte: rangeTo },
        ...(canViewAll ? {} : { companyId: user.companyId }),
        ...(companyId ? { companyId } : {}),
        ...(workArea  ? { workArea }  : {}),
      },
    },
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
    take: 50,
  })

  const pendingApprovalsData = pendingApprovals.map((a) => ({
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
    waitingHours: Math.round((Date.now() - a.document.createdAt.getTime()) / 3600000 * 10) / 10,
  }))

  // ── Document type breakdown ────────────────────────────────────────────────
  const typeMap = new Map<string, number>()
  for (const d of allDocs) {
    typeMap.set(d.type, (typeMap.get(d.type) ?? 0) + 1)
  }
  const byType = [...typeMap.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({
    kpis: {
      createdToday,
      approved: approvedCount,
      rejected: rejectedCount,
      observed: observedCount,
      pendingSignature: pendingSignatureCount,
      pendingApproval: pendingApprovalCount,
      docsWithoutSignature,
      avgApprovalHours,
      criticalRisksCount: criticalRisks.length,
      total: allDocs.length,
    },
    complianceByArea,
    complianceByCompany,
    topErrors,
    criticalRisks,
    pendingApprovals: pendingApprovalsData,
    byType,
    companies: companiesRaw,
    filters: { dateFrom: rangeFrom.toISOString(), dateTo: rangeTo.toISOString() },
  })
}
