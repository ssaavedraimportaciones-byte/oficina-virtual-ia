/**
 * Multi-tenant isolation invariants — R9
 *
 * These tests verify that tenantFilter() enforces company-scoped access:
 * - Non-privileged roles get a companyId filter applied
 * - Privileged roles (SYSTEM_ADMIN, AUDITOR) may query across companies
 * - Cross-company override for non-privileged roles throws TenantViolationError
 */

import { describe, it, expect } from 'vitest'
import { tenantFilter, assertSameTenant, TenantViolationError, isCrossTenantRole } from '@/lib/tenant'
import type { UserRole } from '@/types/user'

const COMPANY_A = 'company_aaa'
const COMPANY_B = 'company_bbb'

const PRIVILEGED: UserRole[] = ['SYSTEM_ADMIN', 'AUDITOR']
const RESTRICTED: UserRole[] = ['WORKER', 'SUPERVISOR', 'PREVENTIONIST', 'CONTRACT_ADMIN', 'MANAGER']

// ── tenantFilter ──────────────────────────────────────────────────────────────

describe('tenantFilter — restricted roles', () => {
  for (const role of RESTRICTED) {
    it(`${role} gets companyId filter`, () => {
      const filter = tenantFilter(role, COMPANY_A)
      expect(filter).toEqual({ companyId: COMPANY_A })
    })

    it(`${role} with matching override gets companyId filter`, () => {
      const filter = tenantFilter(role, COMPANY_A, COMPANY_A)
      expect(filter).toEqual({ companyId: COMPANY_A })
    })

    it(`${role} with different override throws TenantViolationError`, () => {
      expect(() => tenantFilter(role, COMPANY_A, COMPANY_B)).toThrow(TenantViolationError)
    })
  }
})

describe('tenantFilter — privileged roles', () => {
  for (const role of PRIVILEGED) {
    it(`${role} without override returns empty filter (all companies)`, () => {
      const filter = tenantFilter(role, COMPANY_A)
      expect(filter).toEqual({})
    })

    it(`${role} with override returns that company's filter`, () => {
      const filter = tenantFilter(role, COMPANY_A, COMPANY_B)
      expect(filter).toEqual({ companyId: COMPANY_B })
    })
  }
})

// ── assertSameTenant ──────────────────────────────────────────────────────────

describe('assertSameTenant', () => {
  it('passes when resource and user are in the same company', () => {
    expect(() => assertSameTenant(COMPANY_A, 'WORKER', COMPANY_A)).not.toThrow()
  })

  it('throws when resource and user are in different companies (WORKER)', () => {
    expect(() => assertSameTenant(COMPANY_B, 'WORKER', COMPANY_A)).toThrow(TenantViolationError)
  })

  it('throws for MANAGER crossing companies', () => {
    expect(() => assertSameTenant(COMPANY_B, 'MANAGER', COMPANY_A)).toThrow(TenantViolationError)
  })

  it('passes for SYSTEM_ADMIN regardless of company mismatch', () => {
    expect(() => assertSameTenant(COMPANY_B, 'SYSTEM_ADMIN', COMPANY_A)).not.toThrow()
  })

  it('passes for AUDITOR regardless of company mismatch', () => {
    expect(() => assertSameTenant(COMPANY_B, 'AUDITOR', COMPANY_A)).not.toThrow()
  })
})

// ── isCrossTenantRole ─────────────────────────────────────────────────────────

describe('isCrossTenantRole', () => {
  it.each(PRIVILEGED)('%s is cross-tenant', (role) => {
    expect(isCrossTenantRole(role)).toBe(true)
  })

  it.each(RESTRICTED)('%s is NOT cross-tenant', (role) => {
    expect(isCrossTenantRole(role)).toBe(false)
  })
})

// ── Error shape ───────────────────────────────────────────────────────────────

describe('TenantViolationError', () => {
  it('has status 403', () => {
    const err = new TenantViolationError('test')
    expect(err.status).toBe(403)
  })

  it('is named TenantViolationError', () => {
    const err = new TenantViolationError('test')
    expect(err.name).toBe('TenantViolationError')
  })
})
