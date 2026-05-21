import { NextRequest, NextResponse } from 'next/server'
import type { UserRole } from '@/types/user'
import { canAccess, type Permission } from '@/lib/permissions'

export interface AuthUser {
  uid: string
  email: string
  name: string
  role: UserRole
  companyId: string
}

export function getAuthUser(req: NextRequest): AuthUser | null {
  const uid = req.headers.get('x-user-id')
  const email = req.headers.get('x-user-email')
  const name = req.headers.get('x-user-name')
  const role = req.headers.get('x-user-role') as UserRole | null
  const companyId = req.headers.get('x-user-company')

  if (!uid || !email || !role || !companyId) return null
  return { uid, email, name: name ?? '', role, companyId }
}

export function requireAuth(
  req: NextRequest
): { user: AuthUser } | { error: NextResponse } {
  const user = getAuthUser(req)
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }) }
  }
  return { user }
}

export function requirePermission(
  req: NextRequest,
  permission: Permission
): { user: AuthUser } | { error: NextResponse } {
  const result = requireAuth(req)
  if ('error' in result) return result

  if (!canAccess(result.user.role, permission)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return result
}

export function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
