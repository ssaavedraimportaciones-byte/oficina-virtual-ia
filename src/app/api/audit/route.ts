import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/app/api/_lib/auth-middleware'
import { queryLogs } from '@/modules/audit'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  if (!['SYSTEM_ADMIN', 'AUDITOR'].includes(user.role)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const documentId = searchParams.get('documentId') ?? undefined
  const userId     = searchParams.get('userId')     ?? undefined
  const action     = searchParams.get('action')     ?? undefined
  const dateFrom   = searchParams.get('dateFrom')   ?? undefined
  const dateTo     = searchParams.get('dateTo')     ?? undefined
  const limit      = Math.min(Number(searchParams.get('limit')  ?? '100'), 500)
  const offset     = Number(searchParams.get('offset') ?? '0')

  const { logs, total } = await queryLogs({
    role: user.role,
    companyId: user.companyId,
    documentId,
    userId,
    action,
    dateFrom,
    dateTo,
    limit,
    offset,
  })

  return NextResponse.json({ logs, total, limit, offset })
}
