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
  // Fresh store + real timers for each test
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
  it('primer intento no está bloqueado', () => {
    const r = checkRateLimit(KEY_A, POLICY)
    expect(r.blocked).toBe(false)
    expect(r.attempts).toBe(0)
  })

  it('retorna resetAt en el futuro', () => {
    const before = Date.now()
    const r = checkRateLimit(KEY_A, POLICY)
    expect(r.resetAt).toBeGreaterThan(before)
  })
})

// ── recordFailedAttempt — acumulación ─────────────────────────────────────────

describe('recordFailedAttempt — acumulación', () => {
  it('5 intentos fallidos no bloquean (el quinto es el último permitido)', () => {
    let r
    for (let i = 1; i <= 5; i++) {
      r = recordFailedAttempt(KEY_A, POLICY)
    }
    // After 5th attempt, attempts === maxAttempts → blocked
    expect(r!.blocked).toBe(true)
    expect(r!.attempts).toBe(5)
  })

  it('el primer intento fallido incrementa a 1', () => {
    const r = recordFailedAttempt(KEY_A, POLICY)
    expect(r.attempts).toBe(1)
    expect(r.blocked).toBe(false)
  })

  it('4 intentos fallidos no bloquean', () => {
    let r
    for (let i = 0; i < 4; i++) r = recordFailedAttempt(KEY_A, POLICY)
    expect(r!.blocked).toBe(false)
    expect(r!.attempts).toBe(4)
  })

  it('en el 5to intento queda bloqueado', () => {
    for (let i = 0; i < 4; i++) recordFailedAttempt(KEY_A, POLICY)
    const r = recordFailedAttempt(KEY_A, POLICY)
    expect(r.blocked).toBe(true)
  })
})

// ── checkRateLimit — después de bloqueo ───────────────────────────────────────

describe('checkRateLimit — después de bloqueo', () => {
  it('6to check devuelve blocked=true', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(KEY_A, POLICY)
    const r = checkRateLimit(KEY_A, POLICY)
    expect(r.blocked).toBe(true)
  })

  it('attempts refleja cuántos hubo', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(KEY_A, POLICY)
    const r = checkRateLimit(KEY_A, POLICY)
    expect(r.attempts).toBe(5)
  })
})

// ── resetRateLimit ────────────────────────────────────────────────────────────

describe('resetRateLimit', () => {
  it('limpiar después de 4 fallos permite nuevos intentos', () => {
    for (let i = 0; i < 4; i++) recordFailedAttempt(KEY_A, POLICY)
    resetRateLimit(KEY_A)
    const r = checkRateLimit(KEY_A, POLICY)
    expect(r.blocked).toBe(false)
    expect(r.attempts).toBe(0)
  })

  it('limpiar después de bloqueo desbloquea', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(KEY_A, POLICY)
    expect(checkRateLimit(KEY_A, POLICY).blocked).toBe(true)
    resetRateLimit(KEY_A)
    expect(checkRateLimit(KEY_A, POLICY).blocked).toBe(false)
  })

  it('no afecta a otras keys', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(KEY_A, POLICY)
    for (let i = 0; i < 5; i++) recordFailedAttempt(KEY_B, POLICY)
    resetRateLimit(KEY_A)
    expect(checkRateLimit(KEY_A, POLICY).blocked).toBe(false)
    expect(checkRateLimit(KEY_B, POLICY).blocked).toBe(true)
  })
})

// ── Aislamiento por IP ────────────────────────────────────────────────────────

describe('aislamiento por IP', () => {
  it('intentos de IP A no afectan a IP B', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(KEY_A, POLICY)
    const r = checkRateLimit(KEY_B, POLICY)
    expect(r.blocked).toBe(false)
    expect(r.attempts).toBe(0)
  })

  it('bloquear IP A no bloquea IP B', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(KEY_A, POLICY)
    for (let i = 0; i < 3; i++) recordFailedAttempt(KEY_B, POLICY)
    expect(checkRateLimit(KEY_A, POLICY).blocked).toBe(true)
    expect(checkRateLimit(KEY_B, POLICY).blocked).toBe(false)
  })
})

// ── Window expiry ─────────────────────────────────────────────────────────────

describe('expiración de ventana', () => {
  it('ventana expirada trata como cero intentos', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))

    for (let i = 0; i < 4; i++) recordFailedAttempt(KEY_A, POLICY)
    expect(checkRateLimit(KEY_A, POLICY).attempts).toBe(4)

    // Advance past the 15-minute window
    vi.advanceTimersByTime(16 * 60 * 1000)

    const r = checkRateLimit(KEY_A, POLICY)
    expect(r.blocked).toBe(false)
    expect(r.attempts).toBe(0)
  })

  it('block expira después del blockMs', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))

    for (let i = 0; i < 5; i++) recordFailedAttempt(KEY_A, POLICY)
    expect(checkRateLimit(KEY_A, POLICY).blocked).toBe(true)

    // Advance past the 15-minute block period
    vi.advanceTimersByTime(16 * 60 * 1000)

    const r = checkRateLimit(KEY_A, POLICY)
    expect(r.blocked).toBe(false)
  })

  it('dentro de la ventana los intentos se acumulan', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))

    for (let i = 0; i < 3; i++) recordFailedAttempt(KEY_A, POLICY)
    vi.advanceTimersByTime(5 * 60 * 1000) // 5 min — still within window
    for (let i = 0; i < 2; i++) recordFailedAttempt(KEY_A, POLICY)

    const r = checkRateLimit(KEY_A, POLICY)
    expect(r.blocked).toBe(true) // 5 total in same window
  })
})

// ── Seguridad: no revelar internos ────────────────────────────────────────────

describe('respuesta genérica', () => {
  it('recordFailedAttempt no expone email ni credenciales', () => {
    const r = recordFailedAttempt(KEY_A, POLICY)
    const rStr = JSON.stringify(r)
    expect(rStr).not.toContain('email')
    expect(rStr).not.toContain('password')
    expect(rStr).not.toContain('hash')
    expect(rStr).not.toContain('user')
  })

  it('checkRateLimit bloqueado no expone razón interna', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(KEY_A, POLICY)
    const r = checkRateLimit(KEY_A, POLICY)
    const rStr = JSON.stringify(r)
    expect(rStr).not.toContain('password')
    expect(rStr).not.toContain('email')
    expect(r.blocked).toBe(true)
  })
})
