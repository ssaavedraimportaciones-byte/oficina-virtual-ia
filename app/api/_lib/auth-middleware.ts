import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken, type AccessTokenPayload } from '@/lib/auth'

export async function autenticar(
  req: NextRequest
): Promise<{ user: AccessTokenPayload } | { error: NextResponse }> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Token requerido' }, { status: 401 }) }
  }
  const token = authHeader.slice(7)
  try {
    const user = await verifyAccessToken(token)
    return { user }
  } catch {
    return { error: NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 }) }
  }
}

export function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconocida'
}
