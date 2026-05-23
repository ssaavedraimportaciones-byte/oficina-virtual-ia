import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { requirePermission } from '@/app/api/_lib/auth-middleware'
import { tenantFilter } from '@/lib/tenant'

// GET /api/dashboard/executive
// Returns executive-level metrics: active workers, SLA compliance, incidents, multi-company overview.
// Requires MANAGER, SYSTEM_ADMIN, or AUDITOR role.

export async function GET(req: NextRequest) {
  const auth = requirePermission(req, 'dashboard:view')
  if ('error' in auth) return auth.error
  const { user } = auth

  const tf = tenantFilter(user.role, user.companyId)

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [
    activeWorkers,
    totalDocuments30d,
    approvedDocuments30d,
    rejectedDocuments30d,
    pendingApproval,
    documentsWithNoSignature,
    avgApprovalTime,
    recentActivity,
    companySummary,
  ] = await Promise.all([
    // Distinct users who created documents in last 7 days (proxy for active workers)
    prisma.document.findMany({
      where: { ...tf, createdAt: { gte: sevenDaysAgo } },
      select: { createdById: true },
      distinct: ['createdById'],
    }).then((r) => r.length),

    // 30-day document totals
    prisma.document.count({ where: { ...tf, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.document.count({ where: { ...tf, status: 'APPROVED', createdAt: { gte: thirtyDaysAgo } } }),
    prisma.document.count({ where: { ...tf, status: 'REJECTED', createdAt: { gte: thirtyDaysAgo } } }),

    // Current pending approval queue
    prisma.document.count({ where: { ...tf, status: 'PENDING_APPROVAL' } }),

    // Documents past PENDING_SIGNATURE that have 0 signatures (potential incidents)
    prisma.document.count({
      where: {
        ...tf,
        status: { in: ['PENDING_APPROVAL', 'APPROVED', 'CLOSED'] },
        signatures: { none: {} },
      },
    }),

    // Average approval time (hours) in last 30 days
    prisma.approval.findMany({
      where: {
        status: 'APPROVED',
        approvedAt: { not: null, gte: thirtyDaysAgo },
        document: Object.keys(tf).length > 0 ? { companyId: (tf as { companyId?: string }).companyId } : undefined,
      },
      select: { approvedAt: true, document: { select: { createdAt: true } } },
      take: 500,
    }),

    // Recent audit activity (last 24h)
    prisma.auditLog.count({ where: { createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } }),

    // Per-company summary (only for cross-tenant roles)
    Object.keys(tf).length === 0
      ? prisma.company.findMany({
          select: {
            id: true, name: true, type: true,
            _count: {
              select: {
                documents: true,
                users: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        })
      : [],
  ])

  // Compute average approval time
  let avgApprovalHours: number | null = null
  if (avgApprovalTime.length > 0) {
    const totalMs = avgApprovalTime.reduce(
      (sum, a) => a.approvedAt ? sum + (a.approvedAt.getTime() - a.document.createdAt.getTime()) : sum, 0
    )
    avgApprovalHours = Math.round((totalMs / avgApprovalTime.length / 3600000) * 10) / 10
  }

  const complianceRate30d = totalDocuments30d > 0
    ? Math.round((approvedDocuments30d / totalDocuments30d) * 100)
    : null

  // SLA breach: approvals pending > 48h
  const slaBreach48h = await prisma.document.count({
    where: {
      ...tf,
      status: 'PENDING_APPROVAL',
      updatedAt: { lte: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
    },
  })

  return NextResponse.json({
    ts: now.toISOString(),
    period: { from: thirtyDaysAgo.toISOString(), to: now.toISOString() },
    workers: {
      activeLastSevenDays: activeWorkers,
    },
    documents: {
      total30d: totalDocuments30d,
      approved30d: approvedDocuments30d,
      rejected30d: rejectedDocuments30d,
      complianceRate30d,
    },
    approvals: {
      pending: pendingApproval,
      avgApprovalHours,
      slaBreach48h,
    },
    incidents: {
      documentsWithNoSignature,
    },
    activity: {
      auditEventsLast24h: recentActivity,
    },
    companies: companySummary.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      totalDocuments: c._count.documents,
      totalUsers: c._count.users,
    })),
  })
}
