/**
 * Multi-tenant isolation utilities.
 * Every query that touches tenant data must go through these helpers.
 * Violations throw — they are programmer errors, not user errors.
 */

import type { UserRole } from '@/types/user'

const CROSS_TENANT_ROLES: UserRole[] = ['SYSTEM_ADMIN', 'AUDITOR']

/**
 * Returns a Prisma `where` fragment that always scopes to the user's company,
 * unless the role has explicit cross-tenant privileges.
 */
export function tenantFilter(
  userRole: UserRole,
  userCompanyId: string,
  override?: string
): { companyId: string } | Record<string, never> {
  if (CROSS_TENANT_ROLES.includes(userRole)) {
    return override ? { companyId: override } : {}
  }
  if (override && override !== userCompanyId) {
    throw new TenantViolationError(
      `Role ${userRole} cannot query company ${override} (belongs to ${userCompanyId})`
    )
  }
  return { companyId: userCompanyId }
}

/**
 * Asserts that a loaded record belongs to the requester's company.
 * Throws TenantViolationError (→ 403) if it does not.
 */
export function assertSameTenant(
  resourceCompanyId: string,
  userRole: UserRole,
  userCompanyId: string
): void {
  if (CROSS_TENANT_ROLES.includes(userRole)) return
  if (resourceCompanyId !== userCompanyId) {
    throw new TenantViolationError(
      `Access denied: resource belongs to company ${resourceCompanyId}`
    )
  }
}

export class TenantViolationError extends Error {
  readonly status = 403
  constructor(message: string) {
    super(message)
    this.name = 'TenantViolationError'
  }
}

export function isCrossTenantRole(role: UserRole): boolean {
  return CROSS_TENANT_ROLES.includes(role)
}
