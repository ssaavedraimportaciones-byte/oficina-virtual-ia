import type { Redis } from "ioredis";

export interface RateLimitRule {
  /** Máximo de peticiones por ventana. */
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Milisegundos hasta que se reinicia la ventana. */
  resetMs: number;
}

export interface RateLimiter {
  hit(key: string, rule: RateLimitRule): Promise<RateLimitResult>;
}

// INCR + PEXPIRE atómico: la primera petición de la ventana fija la expiración.
const SCRIPT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return {n, ttl}`;

/** Ventana fija en Redis, compartida por todas las réplicas de la API. */
export class RedisRateLimiter implements RateLimiter {
  private fallback = new MemoryRateLimiter();

  constructor(private redis: Redis, private prefix = "pronex:rl:", private onError: (err: Error) => void = () => {}) {}

  async hit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    try {
      const [count, ttl] = (await this.redis.eval(SCRIPT, 1, this.prefix + key, rule.windowMs)) as [number, number];
      return { allowed: count <= rule.limit, remaining: Math.max(0, rule.limit - count), resetMs: ttl };
    } catch (err) {
      // Si Redis cae, la API sigue respondiendo con límites en memoria (por réplica) en vez de fallar.
      this.onError(err as Error);
      return this.fallback.hit(key, rule);
    }
  }
}

/** Para desarrollo local sin Redis. No usar con más de una réplica. */
export class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  async hit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + rule.windowMs };
      this.buckets.set(key, b);
    }
    b.count++;
    return { allowed: b.count <= rule.limit, remaining: Math.max(0, rule.limit - b.count), resetMs: b.resetAt - now };
  }
}

export interface RateLimitPolicy {
  perApiKey: RateLimitRule;
  perUser: RateLimitRule;
  /** Tope agregado por tenant: evita que muchas keys de un cliente saturen la plataforma. */
  perTenant: RateLimitRule;
}

export const DEFAULT_RATE_LIMITS: RateLimitPolicy = {
  perApiKey: { limit: 600, windowMs: 60_000 },
  perUser: { limit: 300, windowMs: 60_000 },
  perTenant: { limit: 3_000, windowMs: 60_000 },
};
