import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { InMemoryCache, buildCacheKey, DASHBOARD_TTL_MS } from '@/modules/dashboard/cache'
import { dashboardFiltersSchema } from '@/modules/dashboard/types'

// ── DASHBOARD_TTL_MS ──────────────────────────────────────────────────────────

describe('DASHBOARD_TTL_MS', () => {
  it('es 60 000 ms (1 minuto)', () => {
    expect(DASHBOARD_TTL_MS).toBe(60_000)
  })
})

// ── InMemoryCache — operaciones básicas ───────────────────────────────────────

describe('InMemoryCache — operaciones básicas', () => {
  let cache: InMemoryCache<string>

  beforeEach(() => {
    cache = new InMemoryCache<string>()
  })

  it('get devuelve undefined para clave inexistente', async () => {
    expect(await cache.get('missing')).toBeUndefined()
  })

  it('set + get devuelven el valor dentro del TTL', async () => {
    await cache.set('k1', 'hello', 5_000)
    expect(await cache.get('k1')).toBe('hello')
  })

  it('delete elimina la entrada', async () => {
    await cache.set('k1', 'hello', 5_000)
    await cache.delete('k1')
    expect(await cache.get('k1')).toBeUndefined()
  })

  it('clear vacía el store', async () => {
    await cache.set('a', 'v1', 5_000)
    await cache.set('b', 'v2', 5_000)
    await cache.clear()
    expect(await cache.get('a')).toBeUndefined()
    expect(await cache.get('b')).toBeUndefined()
    expect(cache.size()).toBe(0)
  })

  it('size refleja el número de entradas vivas', async () => {
    expect(cache.size()).toBe(0)
    await cache.set('x', 'val', 5_000)
    expect(cache.size()).toBe(1)
  })
})

// ── InMemoryCache — TTL expiry ────────────────────────────────────────────────

describe('InMemoryCache — expiración de TTL', () => {
  let cache: InMemoryCache<number>

  beforeEach(() => {
    vi.useFakeTimers()
    cache = new InMemoryCache<number>()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('get devuelve el valor antes de expirar', async () => {
    await cache.set('key', 42, 1_000)
    vi.advanceTimersByTime(999)
    expect(await cache.get('key')).toBe(42)
  })

  it('get devuelve undefined exactamente al expirar', async () => {
    await cache.set('key', 42, 1_000)
    vi.advanceTimersByTime(1_001)
    expect(await cache.get('key')).toBeUndefined()
  })

  it('entrada expirada no se cuenta en size después de get', async () => {
    await cache.set('key', 7, 500)
    vi.advanceTimersByTime(600)
    await cache.get('key') // triggers eviction
    expect(cache.size()).toBe(0)
  })

  it('set con TTL=0 expira inmediatamente', async () => {
    await cache.set('zero', 1, 0)
    vi.advanceTimersByTime(1)
    expect(await cache.get('zero')).toBeUndefined()
  })

  it('set sobreescribe el TTL anterior', async () => {
    await cache.set('key', 10, 500)
    vi.advanceTimersByTime(400)
    await cache.set('key', 20, 1_000) // renew
    vi.advanceTimersByTime(600)
    expect(await cache.get('key')).toBe(20)
  })
})

// ── buildCacheKey ─────────────────────────────────────────────────────────────

describe('buildCacheKey', () => {
  const baseFilters = {
    dateFrom: '2025-01-01',
    dateTo: '2025-01-31',
    companyId: undefined,
    workArea: undefined,
    docType: undefined,
    status: undefined,
    createdBy: undefined,
    cursor: undefined,
    take: 25,
  } as const

  it('produce la misma clave para los mismos parámetros', () => {
    const k1 = buildCacheKey(baseFilters, 'user-1', 'ADMIN')
    const k2 = buildCacheKey(baseFilters, 'user-1', 'ADMIN')
    expect(k1).toBe(k2)
  })

  it('claves diferentes para usuarios diferentes', () => {
    const k1 = buildCacheKey(baseFilters, 'user-1', 'ADMIN')
    const k2 = buildCacheKey(baseFilters, 'user-2', 'ADMIN')
    expect(k1).not.toBe(k2)
  })

  it('claves diferentes para roles diferentes', () => {
    const k1 = buildCacheKey(baseFilters, 'user-1', 'ADMIN')
    const k2 = buildCacheKey(baseFilters, 'user-1', 'WORKER')
    expect(k1).not.toBe(k2)
  })

  it('claves diferentes para fechas diferentes', () => {
    const k1 = buildCacheKey({ ...baseFilters, dateFrom: '2025-01-01' }, 'user-1', 'ADMIN')
    const k2 = buildCacheKey({ ...baseFilters, dateFrom: '2025-02-01' }, 'user-1', 'ADMIN')
    expect(k1).not.toBe(k2)
  })

  it('claves diferentes para companyId diferente', () => {
    const k1 = buildCacheKey({ ...baseFilters, companyId: 'cmp-aaa' }, 'user-1', 'ADMIN')
    const k2 = buildCacheKey({ ...baseFilters, companyId: 'cmp-bbb' }, 'user-1', 'ADMIN')
    expect(k1).not.toBe(k2)
  })

  it('claves diferentes para cursor diferente', () => {
    const k1 = buildCacheKey({ ...baseFilters, cursor: undefined }, 'user-1', 'ADMIN')
    const k2 = buildCacheKey({ ...baseFilters, cursor: 'abc123' }, 'user-1', 'ADMIN')
    expect(k1).not.toBe(k2)
  })

  it('claves diferentes para take diferente', () => {
    const k1 = buildCacheKey({ ...baseFilters, take: 25 }, 'user-1', 'ADMIN')
    const k2 = buildCacheKey({ ...baseFilters, take: 50 }, 'user-1', 'ADMIN')
    expect(k1).not.toBe(k2)
  })
})

// ── dashboardFiltersSchema — validación ───────────────────────────────────────

describe('dashboardFiltersSchema — validación Zod', () => {
  it('acepta objeto vacío y aplica defaults', () => {
    const result = dashboardFiltersSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.take).toBe(25)
    }
  })

  it('acepta filtros válidos completos', () => {
    const result = dashboardFiltersSchema.safeParse({
      dateFrom: '2025-01-01',
      dateTo: '2025-01-31',
      take: '50',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.take).toBe(50)
      expect(result.data.dateFrom).toBe('2025-01-01')
    }
  })

  it('rechaza dateFrom con formato inválido', () => {
    const result = dashboardFiltersSchema.safeParse({ dateFrom: '01-01-2025' })
    expect(result.success).toBe(false)
  })

  it('rechaza dateTo con formato inválido', () => {
    const result = dashboardFiltersSchema.safeParse({ dateTo: '2025/01/31' })
    expect(result.success).toBe(false)
  })

  it('rechaza companyId que no es CUID', () => {
    const result = dashboardFiltersSchema.safeParse({ companyId: 'not-a-cuid' })
    expect(result.success).toBe(false)
  })

  it('rechaza docType inválido', () => {
    const result = dashboardFiltersSchema.safeParse({ docType: 'INVALID_TYPE' })
    expect(result.success).toBe(false)
  })

  it('rechaza status inválido', () => {
    const result = dashboardFiltersSchema.safeParse({ status: 'PENDING' })
    expect(result.success).toBe(false)
  })

  it('rechaza take=0 (mínimo es 1)', () => {
    const result = dashboardFiltersSchema.safeParse({ take: '0' })
    expect(result.success).toBe(false)
  })

  it('rechaza take=101 (máximo es 100)', () => {
    const result = dashboardFiltersSchema.safeParse({ take: '101' })
    expect(result.success).toBe(false)
  })

  it('acepta take como string y lo coerce a número', () => {
    const result = dashboardFiltersSchema.safeParse({ take: '10' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.take).toBe(10)
  })

  it('acepta workArea con hasta 200 caracteres', () => {
    const result = dashboardFiltersSchema.safeParse({ workArea: 'A'.repeat(200) })
    expect(result.success).toBe(true)
  })

  it('rechaza workArea con más de 200 caracteres', () => {
    const result = dashboardFiltersSchema.safeParse({ workArea: 'A'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('acepta todos los docType del enum', () => {
    const validTypes = [
      'SAFETY_TALK', 'DET', 'ART', 'AST', 'WORK_PERMIT',
      'LOTO', 'HEIGHT_WORK', 'CONFINED_SPACE', 'LIFTING_PLAN',
      'EQUIPMENT_CHECKLIST', 'OTHER',
    ]
    for (const docType of validTypes) {
      const result = dashboardFiltersSchema.safeParse({ docType })
      expect(result.success).toBe(true)
    }
  })

  it('acepta todos los status del enum', () => {
    const validStatuses = [
      'DRAFT', 'SCANNED', 'AI_REVIEW', 'OBSERVED', 'PENDING_SIGNATURE',
      'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CLOSED', 'ARCHIVED',
    ]
    for (const status of validStatuses) {
      const result = dashboardFiltersSchema.safeParse({ status })
      expect(result.success).toBe(true)
    }
  })
})

// ── Cursor pagination — lógica de hasMore / nextCursor ───────────────────────

describe('Cursor pagination — lógica take+1', () => {
  function simulatePagination<T extends { id: string }>(
    allItems: T[],
    cursor: string | undefined,
    take: number
  ): { items: T[]; nextCursor: string | null; hasMore: boolean } {
    const startIdx = cursor ? allItems.findIndex((i) => i.id === cursor) + 1 : 0
    const page = allItems.slice(startIdx, startIdx + take + 1)
    const hasMore = page.length > take
    const items = page.slice(0, take)
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null
    return { items, nextCursor, hasMore }
  }

  const dataset = Array.from({ length: 10 }, (_, i) => ({ id: `id-${i + 1}`, name: `item-${i + 1}` }))

  it('primera página sin cursor devuelve los primeros N items', () => {
    const { items, hasMore } = simulatePagination(dataset, undefined, 3)
    expect(items).toHaveLength(3)
    expect(items[0].id).toBe('id-1')
    expect(hasMore).toBe(true)
  })

  it('nextCursor es el id del último item de la página', () => {
    const { nextCursor } = simulatePagination(dataset, undefined, 3)
    expect(nextCursor).toBe('id-3')
  })

  it('segunda página usando el cursor devuelve los siguientes N items', () => {
    const { items } = simulatePagination(dataset, 'id-3', 3)
    expect(items.map((i) => i.id)).toEqual(['id-4', 'id-5', 'id-6'])
  })

  it('última página tiene hasMore=false y nextCursor=null', () => {
    const { items, hasMore, nextCursor } = simulatePagination(dataset, 'id-7', 5)
    expect(hasMore).toBe(false)
    expect(nextCursor).toBeNull()
    expect(items.map((i) => i.id)).toEqual(['id-8', 'id-9', 'id-10'])
  })

  it('take mayor que elementos restantes → hasMore=false', () => {
    const { hasMore, items } = simulatePagination(dataset, undefined, 15)
    expect(hasMore).toBe(false)
    expect(items).toHaveLength(10)
  })

  it('dataset vacío → items vacíos, hasMore=false, nextCursor=null', () => {
    const { items, hasMore, nextCursor } = simulatePagination([], undefined, 5)
    expect(items).toHaveLength(0)
    expect(hasMore).toBe(false)
    expect(nextCursor).toBeNull()
  })
})
