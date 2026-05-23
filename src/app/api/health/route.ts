import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

// GET /api/health — liveness + DB ping
// No requiere autenticación — usado por Vercel health checks y smoke tests
export async function GET() {
  const start = Date.now()

  try {
    await prisma.$queryRaw`SELECT 1`
    const latencyMs = Date.now() - start

    return NextResponse.json({
      status: 'ok',
      db: 'ok',
      latencyMs,
      ts: new Date().toISOString(),
      env: process.env.NODE_ENV ?? 'unknown',
    })
  } catch {
    return NextResponse.json(
      { status: 'error', db: 'unreachable', ts: new Date().toISOString() },
      { status: 503 }
    )
  }
}
