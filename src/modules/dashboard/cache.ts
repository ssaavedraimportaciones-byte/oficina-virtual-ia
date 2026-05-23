import type { DashboardFilters } from './types'

export const DASHBOARD_TTL_MS = 60_000

export interface CacheStore<T> {
  get(key: string): Promise<T | undefined>
  set(key: string, value: T, ttlMs: number): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
}

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class InMemoryCache<T> implements CacheStore<T> {
  private store = new Map<string, CacheEntry<T>>()

  async get(key: string): Promise<T | undefined> {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  async set(key: string, value: T, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async clear(): Promise<void> {
    this.store.clear()
  }

  size(): number {
    return this.store.size
  }
}

export function buildCacheKey(
  filters: DashboardFilters,
  userId: string,
  role: string
): string {
  return [
    role,
    userId,
    filters.dateFrom ?? '',
    filters.dateTo ?? '',
    filters.companyId ?? '',
    filters.workArea ?? '',
    filters.docType ?? '',
    filters.status ?? '',
    filters.createdBy ?? '',
    filters.cursor ?? '',
    String(filters.take),
  ].join(':')
}
