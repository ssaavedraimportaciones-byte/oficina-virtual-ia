import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/app/api/_lib/auth-middleware'
import { getFailedNotifications } from '@/modules/notifications'

export async function GET(req: NextRequest) {
  const result = requirePermission(req, 'documents:view_own')
  if ('error' in result) return result.error

  const { searchParams } = req.nextUrl
  const documentId = searchParams.get('documentId')

  if (!documentId) {
    return NextResponse.json({ error: 'documentId requerido' }, { status: 400 })
  }

  const failed = await getFailedNotifications(documentId)
  return NextResponse.json(failed)
}
