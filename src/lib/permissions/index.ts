import type { UserRole } from '@/types/user'

export type Permission =
  | 'documents:view_own'
  | 'documents:view_all'
  | 'documents:create'
  | 'documents:sign'
  | 'documents:approve'
  | 'documents:observe'
  | 'documents:archive'
  | 'dashboard:view'
  | 'workers:view'
  | 'workers:manage'
  | 'companies:view'
  | 'companies:manage'
  | 'users:view'
  | 'users:manage'
  | 'approvals:view'
  | 'approvals:manage'
  | 'audit:view'
  | 'settings:view'
  | 'settings:manage'

const PERMISSIONS: Record<UserRole, Permission[]> = {
  WORKER: ['documents:view_own', 'documents:sign'],
  SUPERVISOR: [
    'documents:view_own',
    'documents:view_all',
    'documents:create',
    'documents:sign',
    'documents:approve',
    'dashboard:view',
    'workers:view',
    'approvals:view',
    'approvals:manage',
  ],
  PREVENTIONIST: [
    'documents:view_own',
    'documents:view_all',
    'documents:create',
    'documents:sign',
    'documents:approve',
    'documents:observe',
    'dashboard:view',
    'workers:view',
    'approvals:view',
    'approvals:manage',
    'settings:view',
  ],
  CONTRACT_ADMIN: [
    'documents:view_all',
    'dashboard:view',
    'workers:view',
    'workers:manage',
    'companies:view',
    'companies:manage',
    'users:view',
    'users:manage',
    'approvals:view',
    'settings:view',
    'settings:manage',
  ],
  MANAGER: [
    'documents:view_own',
    'documents:view_all',
    'documents:approve',
    'dashboard:view',
    'workers:view',
    'companies:view',
    'approvals:view',
    'approvals:manage',
    'settings:view',
  ],
  AUDITOR: [
    'documents:view_own',
    'documents:view_all',
    'dashboard:view',
    'workers:view',
    'companies:view',
    'users:view',
    'approvals:view',
    'audit:view',
    'settings:view',
  ],
  SYSTEM_ADMIN: [
    'documents:view_own',
    'documents:view_all',
    'documents:create',
    'documents:sign',
    'documents:approve',
    'documents:observe',
    'documents:archive',
    'dashboard:view',
    'workers:view',
    'workers:manage',
    'companies:view',
    'companies:manage',
    'users:view',
    'users:manage',
    'approvals:view',
    'approvals:manage',
    'audit:view',
    'settings:view',
    'settings:manage',
  ],
}

export function canAccess(role: UserRole, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false
}

export function requireRole(role: UserRole, ...allowed: UserRole[]): boolean {
  return allowed.includes(role)
}

const ROUTE_MAP: Array<[string, Permission]> = [
  ['/dashboard', 'dashboard:view'],
  ['/documents/new', 'documents:create'],
  ['/documents', 'documents:view_own'],
  ['/approvals', 'approvals:view'],
  ['/workers', 'workers:view'],
  ['/companies', 'companies:view'],
  ['/users', 'users:view'],
  ['/audit', 'audit:view'],
  ['/settings', 'settings:view'],
  ['/api/documents', 'documents:view_own'],
  ['/api/approvals', 'approvals:view'],
  ['/api/workers', 'workers:view'],
  ['/api/companies', 'companies:view'],
  ['/api/users', 'users:view'],
  ['/api/audit', 'audit:view'],
]

export function getRoutePermission(pathname: string): Permission | null {
  for (const [route, perm] of ROUTE_MAP) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return perm
    }
  }
  return null
}
