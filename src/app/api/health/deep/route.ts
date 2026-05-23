import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

// GET /api/health/deep — comprehensive system health
// No auth required (for external uptime monitors), but omits internals
// Returns 200 if all critical systems are healthy, 503 otherwise

interface CheckResult {
  ok: boolean
  latencyMs?: number
  error?: string
}

async function checkDatabase(): Promise<CheckResult> {
  const t = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return { ok: true, latencyMs: Date.now() - t }
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) }
  }
}

async function checkRedis(): Promise<CheckResult> {
  // Accept both Upstash and generic KV env var naming
  const url   = process.env.UPSTASH_REDIS_REST_URL  ?? process.env.REDIS_URL ?? process.env.KV_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.REDIS_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!url) return { ok: true, error: 'not configured (using in-memory cache)' }

  const t = Date.now()
  try {
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({ url, token: token ?? '' })
    await redis.ping()
    return { ok: true, latencyMs: Date.now() - t }
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) }
  }
}

async function checkStorage(): Promise<CheckResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return { ok: true, error: 'not configured (using local storage)' }
  // Blob doesn't have a ping — just confirm the token is set
  return { ok: true }
}

async function checkInngest(): Promise<CheckResult> {
  if (process.env.JOB_PROVIDER !== 'inngest') {
    return { ok: true, error: 'not configured (using in-memory jobs)' }
  }
  const key = process.env.INNGEST_EVENT_KEY
  if (!key) return { ok: false, error: 'INNGEST_EVENT_KEY missing' }
  return { ok: true }
}

export async function GET() {
  const [db, redis, storage, inngest] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkStorage(),
    checkInngest(),
  ])

  const allOk = db.ok && redis.ok && storage.ok && inngest.ok

  const body = {
    status: allOk ? 'ok' : 'degraded',
    ts: new Date().toISOString(),
    checks: { db, redis, storage, inngest },
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0',
    env: process.env.NODE_ENV ?? 'unknown',
  }

  return NextResponse.json(body, { status: allOk ? 200 : 503 })
}
