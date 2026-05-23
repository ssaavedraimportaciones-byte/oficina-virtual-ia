/**
 * Rate limiting module — sliding window.
 * RATE_LIMIT_PROVIDER=memory (default) | redis
 * Redis: requiere UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
 * Fail policy: fail-closed en producción con provider=redis (seguridad > disponibilidad).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RateLimitOptions {
  maxAttempts: number
  windowMs: number
  blockMs: number
}

export interface RateLimitResult {
  blocked: boolean
  attempts: number
  resetAt: number
}

export interface Entry {
  attempts: number
  firstAttemptAt: number
  blockedUntil: number
}

// ── Store interface (async para compatibilidad con Redis) ─────────────────────

export interface RateLimitStore {
  get(key: string): Promise<Entry | undefined>
  set(key: string, entry: Entry, ttlMs: number): Promise<void>
  delete(key: string): Promise<void>
}

// ── Memory store ──────────────────────────────────────────────────────────────

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly map = new Map<string, Entry>()

  async get(key: string): Promise<Entry | undefined> {
    return this.map.get(key)
  }

  async set(key: string, entry: Entry, _ttlMs: number): Promise<void> {
    this.map.set(key, entry)
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key)
  }

  purgeExpired(windowMs: number): void {
    const now = Date.now()
    for (const [key, entry] of this.map) {
      if (entry.blockedUntil < now && now - entry.firstAttemptAt >= windowMs) {
        this.map.delete(key)
      }
    }
  }
}

// ── Singleton + factory ───────────────────────────────────────────────────────

let _store: RateLimitStore | null = null

export function setRateLimitStore(s: RateLimitStore): void {
  _store = s
}

/** Visible for testing */
export function _resetStoreForTest(): void {
  _store = null
}

function getStore(): RateLimitStore {
  if (_store) return _store
  if (process.env.RATE_LIMIT_PROVIDER === 'redis') {
    const { RedisRateLimitStore } = require('./rate-limit/redis') as typeof import('./rate-limit/redis')
    _store = new RedisRateLimitStore()
  } else {
    _store = new MemoryRateLimitStore()
  }
  return _store
}

// ── Key helper ────────────────────────────────────────────────────────────────

export function getRateLimitKey(ip: string, scope: string): string {
  return `${scope}:${ip}`
}

// ── Fail policy ───────────────────────────────────────────────────────────────

function handleStoreError(now: number, opts: RateLimitOptions): RateLimitResult {
  if (process.env.NODE_ENV === 'production' && process.env.RATE_LIMIT_PROVIDER === 'redis') {
    console.error('[rate-limit] Redis no disponible — fail-closed')
    return { blocked: true, attempts: opts.maxAttempts, resetAt: now + opts.blockMs }
  }
  console.warn('[rate-limit] store falló — fail-open (solo desarrollo)')
  return { blocked: false, attempts: 0, resetAt: now + opts.windowMs }
}

// ── Core functions (async) ────────────────────────────────────────────────────

export async function checkRateLimit(key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now()
  let entry: Entry | undefined
  try { entry = await getStore().get(key) } catch { return handleStoreError(now, opts) }

  if (!entry) return { blocked: false, attempts: 0, resetAt: now + opts.windowMs }
  if (entry.blockedUntil > now) return { blocked: true, attempts: entry.attempts, resetAt: entry.blockedUntil }
  if (now - entry.firstAttemptAt >= opts.windowMs) return { blocked: false, attempts: 0, resetAt: now + opts.windowMs }
  return { blocked: false, attempts: entry.attempts, resetAt: entry.firstAttemptAt + opts.windowMs }
}

export async function recordFailedAttempt(key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now()
  let existing: Entry | undefined
  try { existing = await getStore().get(key) } catch { return handleStoreError(now, opts) }

  let entry: Entry
  if (!existing || now - existing.firstAttemptAt >= opts.windowMs) {
    entry = { attempts: 1, firstAttemptAt: now, blockedUntil: 0 }
  } else {
    entry = { ...existing, attempts: existing.attempts + 1 }
  }

  if (entry.attempts >= opts.maxAttempts) entry.blockedUntil = now + opts.blockMs
  const ttlMs = entry.blockedUntil > now ? opts.blockMs : opts.windowMs

  try { await getStore().set(key, entry, ttlMs) } catch { return handleStoreError(now, opts) }

  return {
    blocked: entry.blockedUntil > now,
    attempts: entry.attempts,
    resetAt: entry.blockedUntil > now ? entry.blockedUntil : entry.firstAttemptAt + opts.windowMs,
  }
}

export async function resetRateLimit(key: string): Promise<void> {
  try { await getStore().delete(key) } catch {
    console.warn('[rate-limit] store.delete falló silenciosamente')
  }
}

// ── Preset policies ───────────────────────────────────────────────────────────

export const LOGIN_RATE_LIMIT: RateLimitOptions = { maxAttempts: 5, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 }
export const REGISTER_RATE_LIMIT: RateLimitOptions = { maxAttempts: 5, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 }
