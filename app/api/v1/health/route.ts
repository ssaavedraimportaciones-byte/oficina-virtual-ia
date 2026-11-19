import { NextResponse } from 'next/server'
import { API_VERSION, apiJson } from '@/lib/apiV1'
import { prisma } from '@/lib/db'
import pkg from '../../../../package.json'

export const dynamic = 'force-dynamic'

/** Estado del servicio. Público (sin clave): sirve para sondas de disponibilidad. No expone datos del negocio. */
export async function GET(): Promise<NextResponse> {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null
  const base = { apiVersion: API_VERSION, version: pkg.version, commit, timestamp: new Date().toISOString() }
  try {
    await prisma.$queryRaw`SELECT 1`
    return apiJson({ data: { status: 'ok', database: 'ok', ...base } })
  } catch {
    return apiJson({ data: { status: 'degraded', database: 'error', ...base } }, 503)
  }
}
