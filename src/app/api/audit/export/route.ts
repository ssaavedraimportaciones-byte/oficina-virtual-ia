import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/app/api/_lib/auth-middleware'
import { queryLogs } from '@/modules/audit'
import type { AuditLogEntry } from '@/modules/audit'

function escapeCsv(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function rowToCsv(row: AuditLogEntry): string {
  return [
    row.createdAt,
    row.action,
    row.user?.name ?? '',
    row.user?.email ?? '',
    row.user?.role ?? '',
    row.document?.folio ?? '',
    row.document?.type ?? '',
    row.ipAddress ?? '',
    row.gpsLat ?? '',
    row.gpsLng ?? '',
    row.metadata ? JSON.stringify(row.metadata) : '',
  ].map(escapeCsv).join(',')
}

const CSV_HEADER = 'timestamp,action,userName,userEmail,userRole,folio,documentType,ipAddress,gpsLat,gpsLng,metadata'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  if (user.role !== 'SYSTEM_ADMIN') {
    return NextResponse.json({ error: 'Solo SYSTEM_ADMIN puede exportar el log completo' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const documentId = searchParams.get('documentId') ?? undefined
  const userId     = searchParams.get('userId')     ?? undefined
  const action     = searchParams.get('action')     ?? undefined
  const dateFrom   = searchParams.get('dateFrom')   ?? undefined
  const dateTo     = searchParams.get('dateTo')     ?? undefined

  const { logs } = await queryLogs({
    role: user.role,
    companyId: user.companyId,
    documentId,
    userId,
    action,
    dateFrom,
    dateTo,
    limit: 500,
    offset: 0,
  })

  const lines = [CSV_HEADER, ...logs.map(rowToCsv)]
  const csv = lines.join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
