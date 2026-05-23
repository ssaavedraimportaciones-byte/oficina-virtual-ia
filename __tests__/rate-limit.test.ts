import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  getRateLimitKey,
  setRateLimitStore,
  MemoryRateLimitStore,
  type RateLimitOptions,
} from '@/lib/rate-limit'

const POLICY: RateLimitOptions = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
}

const IP_A = '203.0.113.1'
const IP_B = '203.0.113.2'
const KEY_A = getRateLimitKey(IP_A, 'auth:login')
const KEY_B = getRateLimitKey(IP_B, 'auth:login')

beforeEach(() => {
  setRateLimitStore(new MemoryRateLimitStore())
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// ── getRateLimitKey ────────────────────────────────────────────────────────────

describe('getRateLimitKey', () => {
  it('combina scope e IP', () => {
    expect(getRateLimitKey('1.2.3.4', 'auth:login')).toBe('auth:login:1.2.3.4')
  })

  it('keys distintas por IP', () => {
    expect(getRateLimitKey(IP_A, 'auth:login')).not.toBe(getRateLimitKey(IP_B, 'auth:login'))
  })

  it('keys distintas por scope', () => {
    expect(getRateLimitKey(IP_A, 'auth:login')).not.toBe(getRateLimitKey(IP_A, 'auth:register'))
  })
})

// ── checkRateLimit — estado inicial ───────────────────────────────────────────

describe('checkRateLimit — sin intentos previos', () => {
  it('primer intento no está bloqueado', async () => {
    const r = await checkRateLimit(KEY_A, POLICY)
    expect(r.blocked).toBe(false)
    expect(r.attempts).toBe(0)
  })

  it('retorna resetAt en el futuro', async () => {
    const before = Date.now()
    const r = await checkRateLimit(KEY_A, POLICY)
    expect(r.resetAt).toBeGreaterThan(before)
  })
})

// ── recordFailedAttempt — acumulación ─────────────────────────────────────────

describe('recordFailedAttempt — acumulación', () => {
  it('5 intentos fallidos bloquean en el quinto', async () => {
    let r
    for (let i = 1; i <= 5; i++) {
      r = await recordFailedAttempt(KEY_A, POLICY)
    }
    expect(r!.blocked).toBe(true)
    expect(r!.attempts).toBe(5)
  })

  it('el primer intento fallido incrementa a 1', async () => {
    const r = await recordFailedAttempt(KEY_A, POLICY)
    expect(r.attempts).toBe(1)
    expect(r.blocked).toBe(false)
  })

  it('4 intentos fallidos no bloquean', async () => {
    let r
    for (let i = 0; i < 4; i++) r = await recordFailedAttempt(KEY_A, POLICY)
    expect(r!.blocked).toBe(false)
    expect(r!.attempts).toBe(4)
  })

  it('en el 5to intento queda bloqueado', async () => {
    for (let i = 0; i < 4; i++) await recordFailedAttempt(KEY_A, POLICY)
    const r = await recordFailedAttempt(KEY_A, POLICY)
    expect(r.blocked).toBe(true)
  })
})

// ── checkRateLimit — después de bloqueo ───────────────────────────────────────

describe('checkRateLimit — después de bloqueo', () => {
  it('6to check devuelve blocked=true', async () => {
    for (let i = 0; i < 5; i++) await recordFailedAttempt(KEY_A, POLICY)
    const r = await checkRateLimit(KEY_A, POLICY)
    expect(r.blocked).toBe(true)
  })

  it('attempts refleja cuántos hubo', async () => {
    for (let i = 0; i < 5; i++) await recordFailedAttempt(KEY_A, POLICY)
    const r = await checkRateLimit(KEY_A, POLICY)
    expect(r.attempts).toBe(5)
  })
})

// ── resetRateLimit ────────────────────────────────────────────────────────────

describe('resetRateLimit', () => {
  it('limpiar después de 4 fallos permite nuevos intentos', async () => {
    for (let i = 0; i < 4; i++) await recordFailedAttempt(KEY_A, POLICY)
    await resetRateLimit(KEY_A)
    const r = await checkRateLimit(KEY_A, POLICY)
    expect(r.blocked).toBe(false)
    expect(r.attempts).toBe(0)
  })

  it('limpiar después de bloqueo desbloquea', async () => {
    for (let i = 0; i < 5; i++) await recordFailedAttempt(KEY_A, POLICY)
    expect((await checkRateLimit(KEY_A, POLICY)).blocked).toBe(true)
    await resetRateLimit(KEY_A)
    expect((await checkRateLimit(KEY_A, POLICY)).blocked).toBe(false)
  })

  it('no afecta a otras keys', async () => {
    for (let i = 0; i < 5; i++) await recordFailedAttempt(KEY_A, POLICY)
    for (let i = 0; i < 5; i++) await recordFailedAttempt(KEY_B, POLICY)
    await resetRateLimit(KEY_A)
    expect((await checkRateLimit(KEY_A, POLICY)).blocked).toBe(false)
    expect((await checkRateLimit(KEY_B, POLICY)).blocked).toBe(true)
  })
})

// ── Aislamiento por IP ────────────────────────────────────────────────────────

describe('aislamiento por IP', () => {
  it('intentos de IP A no afectan a IP B', async () => {
    for (let i = 0; i < 5; i++) await recordFailedAttempt(KEY_A, POLICY)
    const r = await checkRateLimit(KEY_B, POLICY)
    expect(r.blocked).toBe(false)
    expect(r.attempts).toBe(0)
  })

  it('bloquear IP A no bloquea IP B', async () => {
    for (let i = 0; i < 5; i++) await recordFailedAttempt(KEY_A, POLICY)
    for (let i = 0; i < 3; i++) await recordFailedAttempt(KEY_B, POLICY)
    expect((await checkRateLimit(KEY_A, POLICY)).blocked).toBe(true)
    expect((await checkRateLimit(KEY_B, POLICY)).blocked).toBe(false)
  })
})

// ── Window expiry ─────────────────────────────────────────────────────────────

describe('expiración de ventana', () => {
  it('ventana expirada trata como cero intentos', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))

    for (let i = 0; i < 4; i++) await recordFailedAttempt(KEY_A, POLICY)
    expect((await checkRateLimit(KEY_A, POLICY)).attempts).toBe(4)

    vi.advanceTimersByTime(16 * 60 * 1000)

    const r = await checkRateLimit(KEY_A, POLICY)
    expect(r.blocked).toBe(false)
    expect(r.attempts).toBe(0)
  })

  it('block expira después del blockMs', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))

    for (let i = 0; i < 5; i++) await recordFailedAttempt(KEY_A, POLICY)
    expect((await checkRateLimit(KEY_A, POLICY)).blocked).toBe(true)

    vi.advanceTimersByTime(16 * 60 * 1000)

    const r = await checkRateLimit(KEY_A, POLICY)
    expect(r.blocked).toBe(false)
  })

  it('dentro de la ventana los intentos se acumulan', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))

    for (let i = 0; i < 3; i++) await recordFailedAttempt(KEY_A, POLICY)
    vi.advanceTimersByTime(5 * 60 * 1000)
    for (let i = 0; i < 2; i++) await recordFailedAttempt(KEY_A, POLICY)

    const r = await checkRateLimit(KEY_A, POLICY)
    expect(r.blocked).toBe(true)
  })
})

// ── Seguridad: no revelar internos ────────────────────────────────────────────

describe('respuesta genérica', () => {
  it('recordFailedAttempt no expone email ni credenciales', async () => {
    const r = await recordFailedAttempt(KEY_A, POLICY)
    const rStr = JSON.stringify(r)
    expect(rStr).not.toContain('email')
    expect(rStr).not.toContain('password')
    expect(rStr).not.toContain('hash')
    expect(rStr).not.toContain('user')
  })

  it('checkRateLimit bloqueado no expone razón interna', async () => {
    for (let i = 0; i < 5; i++) await recordFailedAttempt(KEY_A, POLICY)
    const r = await checkRateLimit(KEY_A, POLICY)
    const rStr = JSON.stringify(r)
    expect(rStr).not.toContain('password')
    expect(rStr).not.toContain('email')
    expect(r.blocked).toBe(true)
  })
})

// ── Redis store mock ──────────────────────────────────────────────────────────

describe('RedisRateLimitStore — mock', () => {
  it('respeta la interfaz async RateLimitStore', async () => {
    const mockStore = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }
    setRateLimitStore(mockStore)

    const r = await checkRateLimit(KEY_A, POLICY)
    expect(r.blocked).toBe(false)
    expect(mockStore.get).toHaveBeenCalledWith(KEY_A)
  })

  it('fail-closed en producción con redis provider', async () => {
    const originalEnv = process.env.NODE_ENV
    const originalProvider = process.env.RATE_LIMIT_PROVIDER
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    process.env.RATE_LIMIT_PROVIDER = 'redis'

    const mockStore = {
      get: vi.fn().mockRejectedValue(new Error('Redis down')),
      set: vi.fn().mockRejectedValue(new Error('Redis down')),
      delete: vi.fn().mockRejectedValue(new Error('Redis down')),
    }
    setRateLimitStore(mockStore)

    const r = await checkRateLimit(KEY_A, POLICY)
    expect(r.blocked).toBe(true)

    ;(process.env as Record<string, string>).NODE_ENV = originalEnv ?? 'test'
    process.env.RATE_LIMIT_PROVIDER = originalProvider
  })
})
