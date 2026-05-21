import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/app/api/_lib/auth-middleware'
import { getPendingApprovals } from '@/modules/approvals'

/**
 * GET /api/approvals
 * Returns all pending approval steps that match the authenticated user's role
 * and are currently unlocked (prior steps completed).
 */
export async function GET(req: NextRequest) {
  const auth = requirePermission(req, 'approvals:view')
  if ('error' in auth) return auth.error
  const { user } = auth

  const items = await getPendingApprovals(user.uid, user.role)
  return NextResponse.json({ approvals: items, count: items.length })
}
