import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase-admin'
import { puedeVerAuditoria } from '@/lib/roles'
import { autenticar, getIp } from '../_lib/auth-middleware'
import type { UserRole } from '@/types/user'

export async function GET(req: NextRequest) {
  const auth = await autenticar(req)
  if ('error' in auth) return auth.error

  const { user } = auth

  if (!puedeVerAuditoria(user.role as UserRole)) {
    return NextResponse.json({ error: 'Acceso restringido a admin y auditor' }, { status: 403 })
  }

  const db = getDb()
  const url = new URL(req.url)
  const documentId = url.searchParams.get('documentId')
  const userId = url.searchParams.get('userId')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100'), 500)

  let query = db.collection('sc_audit_log').orderBy('timestamp', 'desc').limit(limit)
  if (documentId) query = query.where('documentId', '==', documentId) as typeof query
  if (userId) query = query.where('userId', '==', userId) as typeof query

  const snap = await query.get()
  const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

  return NextResponse.json({ logs, total: logs.length })
}
