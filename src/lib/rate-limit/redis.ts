import { Redis } from '@upstash/redis'
import type { RateLimitStore, Entry } from '@/lib/rate-limit'

export class RedisRateLimitStore implements RateLimitStore {
  private readonly redis: Redis

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }

  async get(key: string): Promise<Entry | undefined> {
    const entry = await this.redis.get<Entry>(`rl:${key}`)
    return entry ?? undefined
  }

  async set(key: string, entry: Entry, ttlMs: number): Promise<void> {
    await this.redis.set(`rl:${key}`, entry, { ex: Math.ceil(ttlMs / 1000) })
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(`rl:${key}`)
  }
}
