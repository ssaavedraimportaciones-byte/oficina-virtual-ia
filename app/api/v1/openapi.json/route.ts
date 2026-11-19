import { NextResponse } from 'next/server'
import { buildOpenApi } from '@/lib/openapi'

export const dynamic = 'force-static'

/** Especificación OpenAPI 3.1 de la API v1. Pública: no requiere clave. */
export function GET(): NextResponse {
  return NextResponse.json(buildOpenApi(), { headers: { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' } })
}
