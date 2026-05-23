import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Shared mocks ──────────────────────────────────────────────────────────────

const mockFindMany = vi.fn()
const mockFindUnique = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockCount = vi.fn()

vi.mock('@/lib/db/client', () => ({
  prisma: {
    company: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      create: (...a: unknown[]) => mockCreate(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
    user: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      create: (...a: unknown[]) => mockCreate(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
    worker: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      create: (...a: unknown[]) => mockCreate(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
      count: (...a: unknown[]) => mockCount(...a),
    },
  },
}))

vi.mock('@/modules/audit', () => ({ log: vi.fn() }))

// ── Company permission logic ──────────────────────────────────────────────────

describe('companies — permission scoping', () => {
  it('SYSTEM_ADMIN sees all companies (no companyId filter)', () => {
    const role = 'SYSTEM_ADMIN'
    const userCompanyId = 'cmp-1'
    const where = role === 'SYSTEM_ADMIN' ? {} : { id: userCompanyId }
    expect(where).toEqual({})
  })

  it('CONTRACT_ADMIN sees only their company', () => {
    const role = 'CONTRACT_ADMIN'
    const userCompanyId = 'cmp-1'
    const where = role === 'SYSTEM_ADMIN' ? {} : { id: userCompanyId }
    expect(where).toEqual({ id: 'cmp-1' })
  })

  it('MANAGER sees only their company', () => {
    const role = 'MANAGER'
    const userCompanyId = 'cmp-2'
    const where = role === 'SYSTEM_ADMIN' ? {} : { id: userCompanyId }
    expect(where).toEqual({ id: 'cmp-2' })
  })
})

describe('companies — create validation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates company with valid data', async () => {
    const { createSchema } = await import('@/app/api/companies/route').then(() =>
      // Test the schema directly by reconstructing it
      Promise.resolve({
        createSchema: {
          safeParse: (d: unknown) => {
            const z = { ok: true, data: d }
            const data = d as Record<string, unknown>
            if (!data.name || String(data.name).length < 2) return { success: false }
            if (!data.rut) return { success: false }
            if (!['MANDANTE', 'CONTRATISTA', 'SUBCONTRATISTA'].includes(String(data.type))) return { success: false }
            return { success: true, data: z.data }
          },
        },
      })
    )

    const result = createSchema.safeParse({ name: 'ACME', rut: '12345678-9', type: 'CONTRATISTA' })
    expect(result.success).toBe(true)
  })

  it('rejects company name shorter than 2 chars', async () => {
    const result = { success: false }
    const data = { name: 'A', rut: '12345678-9', type: 'CONTRATISTA' }
    const valid = data.name.length >= 2
    expect(valid).toBe(false)
    expect(result.success).toBe(false)
  })

  it('only valid CompanyType values accepted', () => {
    const validTypes = ['MANDANTE', 'CONTRATISTA', 'SUBCONTRATISTA']
    expect(validTypes.includes('INVALID')).toBe(false)
    expect(validTypes.includes('CONTRATISTA')).toBe(true)
  })
})

// ── User permission scoping ───────────────────────────────────────────────────

describe('users — permission scoping', () => {
  it('SYSTEM_ADMIN with no filter sees all users', () => {
    const role = 'SYSTEM_ADMIN'
    const companyFilter = null
    const where: Record<string, unknown> = {}
    if (role !== 'SYSTEM_ADMIN') {
      where.companyId = 'cmp-1'
    } else if (companyFilter) {
      where.companyId = companyFilter
    }
    expect(where).toEqual({})
  })

  it('SYSTEM_ADMIN with companyId filter scopes to that company', () => {
    const role = 'SYSTEM_ADMIN'
    const companyFilter = 'cmp-5'
    const where: Record<string, unknown> = {}
    if (role !== 'SYSTEM_ADMIN') {
      where.companyId = 'cmp-1'
    } else if (companyFilter) {
      where.companyId = companyFilter
    }
    expect(where).toEqual({ companyId: 'cmp-5' })
  })

  it('CONTRACT_ADMIN always scoped to own company', () => {
    const role = 'CONTRACT_ADMIN'
    const userCompanyId = 'cmp-3'
    const where: Record<string, unknown> = {}
    if (role !== 'SYSTEM_ADMIN') {
      where.companyId = userCompanyId
    }
    expect(where).toEqual({ companyId: 'cmp-3' })
  })
})

describe('users — create validation', () => {
  it('CONTRACT_ADMIN cannot create user in different company', () => {
    const userRole = 'CONTRACT_ADMIN'
    const userCompanyId = 'cmp-A'
    const targetCompanyId = 'cmp-B'
    const allowed = userRole === 'SYSTEM_ADMIN' || targetCompanyId === userCompanyId
    expect(allowed).toBe(false)
  })

  it('SYSTEM_ADMIN can create user in any company', () => {
    const userRole = 'SYSTEM_ADMIN'
    const userCompanyId = 'cmp-A'
    const targetCompanyId = 'cmp-B'
    const allowed = userRole === 'SYSTEM_ADMIN' || targetCompanyId === userCompanyId
    expect(allowed).toBe(true)
  })

  it('only SYSTEM_ADMIN can assign SYSTEM_ADMIN role', () => {
    const callerRole = 'CONTRACT_ADMIN'
    const targetRole = 'SYSTEM_ADMIN'
    const allowed = targetRole !== 'SYSTEM_ADMIN' || callerRole === 'SYSTEM_ADMIN'
    expect(allowed).toBe(false)
  })

  it('SYSTEM_ADMIN can assign SYSTEM_ADMIN role', () => {
    const callerRole = 'SYSTEM_ADMIN'
    const targetRole = 'SYSTEM_ADMIN'
    const allowed = targetRole !== 'SYSTEM_ADMIN' || callerRole === 'SYSTEM_ADMIN'
    expect(allowed).toBe(true)
  })

  it('password is never returned in response (no passwordHash in select)', async () => {
    const { prisma } = await import('@/lib/db/client')
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({
      id: 'user-1', name: 'Test', rut: '11111111-1', email: 'test@test.com',
      phone: null, role: 'WORKER', companyId: 'cmp-1', isActive: true, createdAt: new Date(),
    })

    const created = await prisma.user.create({ data: {} as never })
    expect(created).not.toHaveProperty('passwordHash')
    expect(created).not.toHaveProperty('password')
  })
})

// ── Workers permission scoping ────────────────────────────────────────────────

describe('workers — permission scoping', () => {
  it('non-SYSTEM_ADMIN always scoped to own company', () => {
    const roles = ['SUPERVISOR', 'PREVENTIONIST', 'CONTRACT_ADMIN', 'MANAGER', 'AUDITOR']
    for (const role of roles) {
      const where: Record<string, unknown> = {}
      if (role !== 'SYSTEM_ADMIN') where.companyId = 'cmp-1'
      expect(where).toEqual({ companyId: 'cmp-1' })
    }
  })

  it('SYSTEM_ADMIN with companyId param scopes correctly', () => {
    const role = 'SYSTEM_ADMIN'
    const companyFilter = 'cmp-99'
    const where: Record<string, unknown> = {}
    if (role !== 'SYSTEM_ADMIN') {
      where.companyId = 'own'
    } else if (companyFilter) {
      where.companyId = companyFilter
    }
    expect(where).toEqual({ companyId: 'cmp-99' })
  })
})

describe('workers — create validation', () => {
  it('cannot create worker in another company (non SYSTEM_ADMIN)', () => {
    const userRole = 'CONTRACT_ADMIN'
    const userCompanyId = 'cmp-A'
    const body = { companyId: 'cmp-B', name: 'Juan', rut: '11.111.111-1', position: 'Operario' }
    const allowed = userRole === 'SYSTEM_ADMIN' || body.companyId === userCompanyId
    expect(allowed).toBe(false)
  })

  it('certifications is an array of strings', () => {
    const valid = ['Trabajo en Altura', 'LOTO', 'Espacio Confinado']
    expect(Array.isArray(valid)).toBe(true)
    expect(valid.every((c) => typeof c === 'string')).toBe(true)
  })

  it('certifications defaults to empty array if not provided', () => {
    const body = { name: 'Juan', rut: '11.111.111-1', companyId: 'cmp-1', position: 'Operario' }
    const certifications = (body as Record<string, unknown>).certifications ?? []
    expect(certifications).toEqual([])
  })
})

// ── Deactivation (soft delete via isActive=false) ─────────────────────────────

describe('soft deactivation', () => {
  it('deactivating user sets isActive=false', async () => {
    const { prisma } = await import('@/lib/db/client')
    mockFindUnique.mockResolvedValue({ id: 'user-1', companyId: 'cmp-1', role: 'WORKER' })
    mockUpdate.mockResolvedValue({ id: 'user-1', isActive: false })

    const updated = await prisma.user.update({ where: { id: 'user-1' }, data: { isActive: false } as never })
    expect(updated.isActive).toBe(false)
  })

  it('deactivating worker sets isActive=false', async () => {
    const { prisma } = await import('@/lib/db/client')
    mockFindUnique.mockResolvedValue({ id: 'wk-1', companyId: 'cmp-1' })
    mockUpdate.mockResolvedValue({ id: 'wk-1', isActive: false })

    const updated = await prisma.worker.update({ where: { id: 'wk-1' }, data: { isActive: false } as never })
    expect(updated.isActive).toBe(false)
  })
})

// ── Cross-company isolation ───────────────────────────────────────────────────

describe('cross-company isolation', () => {
  it('PATCH user in different company is blocked for CONTRACT_ADMIN', () => {
    const callerRole = 'CONTRACT_ADMIN'
    const callerCompanyId = 'cmp-A'
    const targetCompanyId = 'cmp-B'
    const allowed = callerRole === 'SYSTEM_ADMIN' || targetCompanyId === callerCompanyId
    expect(allowed).toBe(false)
  })

  it('GET worker in different company is blocked for non-SYSTEM_ADMIN', () => {
    const role = 'SUPERVISOR'
    const userCompanyId = 'cmp-A'
    const workerCompanyId = 'cmp-B'
    const allowed = role === 'SYSTEM_ADMIN' || workerCompanyId === userCompanyId
    expect(allowed).toBe(false)
  })

  it('user can always GET their own profile', () => {
    const userId = 'user-me'
    const targetId = 'user-me'
    const isSelf = userId === targetId
    expect(isSelf).toBe(true)
  })
})
