/**
 * Rate limiting module — sliding window, in-memory store.
 *
 * DEUDA TÉCNICA (FASE 2/infra):
 * MemoryRateLimitStore NO es apto para producción multi-instancia o serverless:
 * cada instancia de proceso tiene su propio Map → un atacante distribuido
 * puede evadir el límite si llega a distintas instancias.
 * Migrar a RedisRateLimitStore antes de despliegue multi-región.
 * La interfaz RateLimitStore está diseñada para ese reemplazo sin cambios de API.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RateLimitOptions {
  /** Maximum failed attempts before blocking */
  maxAttempts: number
  /** Sliding window duration in ms */
  windowMs: number
  /** How long to block after maxAttempts is reached, in ms */
  blockMs: number
}

export interface RateLimitResult {
  blocked: boolean
  attempts: number
  /** Epoch ms when the block or window resets */
  resetAt: number
}

interface Entry {
  attempts: number
  firstAttemptAt: number
  /** 0 means not blocked */
  blockedUntil: number
}

// ── Store interface ───────────────────────────────────────────────────────────

export interface RateLimitStore {
  get(key: string): Entry | undefined
  set(key: string, entry: Entry): void
  delete(key: string): void
}

// ── Memory store ──────────────────────────────────────────────────────────────

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly map = new Map<string, Entry>()

  get(key: string): Entry | undefined {
    return this.map.get(key)
  }

  set(key: string, entry: Entry): void {
    this.map.set(key, entry)
  }

  delete(key: string): void {
    this.map.delete(key)
  }

  /** Removes all expired entries. Call periodically to avoid memory growth. */
  purgeExpired(windowMs: number): void {
    const now = Date.now()
    for (const [key, entry] of this.map) {
      const expired =
        entry.blockedUntil < now && now - entry.firstAttemptAt >= windowMs
      if (expired) this.map.delete(key)
    }
  }
}

// ── Module-level singleton store ──────────────────────────────────────────────
// Can be replaced in tests or when wiring Redis.

let _store: RateLimitStore = new MemoryRateLimitStore()

/** Replace the backing store (use in tests or to wire Redis). */
export function setRateLimitStore(s: RateLimitStore): void {
  _store = s
}

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Returns the rate-limit key for a given IP and scope.
 * Never embed raw email in the key — use scope to namespace.
 */
export function getRateLimitKey(ip: string, scope: string): string {
  return `${scope}:${ip}`
}

/**
 * Checks whether a key is currently rate-limited.
 * Does NOT record an attempt — call recordFailedAttempt() on failure.
 */
export function checkRateLimit(
  key: string,
  opts: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  const entry = _store.get(key)

  if (!entry) {
    return { blocked: false, attempts: 0, resetAt: now + opts.windowMs }
  }

  // Actively blocked
  if (entry.blockedUntil > now) {
    return { blocked: true, attempts: entry.attempts, resetAt: entry.blockedUntil }
  }

  // Window has expired — treat as clean
  if (now - entry.firstAttemptAt >= opts.windowMs) {
    return { blocked: false, attempts: 0, resetAt: now + opts.windowMs }
  }

  return {
    blocked: false,
    attempts: entry.attempts,
    resetAt: entry.firstAttemptAt + opts.windowMs,
  }
}

/**
 * Records a failed attempt for a key.
 * Returns the updated state after recording — check .blocked to decide response.
 */
export function recordFailedAttempt(
  key: string,
  opts: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  const existing = _store.get(key)

  let entry: Entry
  if (!existing || now - existing.firstAttemptAt >= opts.windowMs) {
    // Fresh window
    entry = { attempts: 1, firstAttemptAt: now, blockedUntil: 0 }
  } else {
    entry = { ...existing, attempts: existing.attempts + 1 }
  }

  if (entry.attempts >= opts.maxAttempts) {
    entry.blockedUntil = now + opts.blockMs
  }

  _store.set(key, entry)

  return {
    blocked: entry.blockedUntil > now,
    attempts: entry.attempts,
    resetAt:
      entry.blockedUntil > now
        ? entry.blockedUntil
        : entry.firstAttemptAt + opts.windowMs,
  }
}

/**
 * Clears all recorded attempts for a key (call on successful login).
 */
export function resetRateLimit(key: string): void {
  _store.delete(key)
}

// ── Preset policies ───────────────────────────────────────────────────────────

export const LOGIN_RATE_LIMIT: RateLimitOptions = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
}

export const REGISTER_RATE_LIMIT: RateLimitOptions = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
}
