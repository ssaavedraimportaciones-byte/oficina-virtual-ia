import { Redis } from '@upstash/redis'
import type { CacheStore } from './cache'

export class RedisCache<T> implements CacheStore<T> {
  private readonly redis: Redis

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }

  async get(key: string): Promise<T | undefined> {
    try {
      const value = await this.redis.get<T>(`cache:${key}`)
      return value ?? undefined
    } catch {
      console.warn('[dashboard-cache] Redis get falló — fail-open')
      return undefined
    }
  }

  async set(key: string, value: T, ttlMs: number): Promise<void> {
    try {
      await this.redis.set(`cache:${key}`, value, { ex: Math.ceil(ttlMs / 1000) })
    } catch {
      console.warn('[dashboard-cache] Redis set falló — fail-open')
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(`cache:${key}`)
    } catch {
      console.warn('[dashboard-cache] Redis delete falló — fail-open')
    }
  }

  async clear(): Promise<void> {
    console.warn('[dashboard-cache] clear() no soportado en RedisCache')
  }
}
