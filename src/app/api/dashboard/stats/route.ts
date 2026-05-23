import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/app/api/_lib/auth-middleware'
import {
  dashboardFiltersSchema,
  loadDashboardStats,
  dashboardCache,
  buildCacheKey,
  DASHBOARD_TTL_MS,
} from '@/modules/dashboard'

// ── GET /api/dashboard/stats ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = requirePermission(req, 'dashboard:view')
  if ('error' in auth) return auth.error
  const { user } = auth

  const { searchParams } = req.nextUrl
  const rawFilters = {
    dateFrom:  searchParams.get('dateFrom')  ?? undefined,
    dateTo:    searchParams.get('dateTo')    ?? undefined,
    companyId: searchParams.get('companyId') ?? undefined,
    workArea:  searchParams.get('workArea')  ?? undefined,
    docType:   searchParams.get('docType')   ?? undefined,
    status:    searchParams.get('status')    ?? undefined,
    createdBy: searchParams.get('createdBy') ?? undefined,
    cursor:    searchParams.get('cursor')    ?? undefined,
    take:      searchParams.get('take')      ?? undefined,
  }

  const parsed = dashboardFiltersSchema.safeParse(rawFilters)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Parámetros inválidos' },
      { status: 400 }
    )
  }
  const filters = parsed.data

  const cacheKey = buildCacheKey(filters, user.uid, user.role)
  const cached = await dashboardCache.get(cacheKey)
  if (cached) return NextResponse.json(cached)

  const stats = await loadDashboardStats(filters, user)
  await dashboardCache.set(cacheKey, stats, DASHBOARD_TTL_MS)

  return NextResponse.json(stats)
}
