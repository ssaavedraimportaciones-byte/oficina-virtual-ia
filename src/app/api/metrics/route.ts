import { NextRequest, NextResponse } from 'next/server'
import { getMetrics } from '@/lib/observability'

// GET /api/metrics — exposes in-process counters
// Restricted to SYSTEM_ADMIN (enforced by RBAC middleware)
export async function GET(_req: NextRequest) {
  const metrics = getMetrics()
  return NextResponse.json({ metrics, ts: new Date().toISOString() })
}
