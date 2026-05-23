import { SignJWT, jwtVerify } from 'jose'
import { JWT_SECRET } from '@/lib/env'

const CSRF_TTL_SEC = 60 * 60 * 4 // 4 hours

export async function generateCsrfToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET)
  return new SignJWT({ uid: userId, purpose: 'csrf' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + CSRF_TTL_SEC)
    .sign(secret)
}

export async function verifyCsrfToken(token: string, userId: string): Promise<boolean> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    return payload['uid'] === userId && payload['purpose'] === 'csrf'
  } catch {
    return false
  }
}

// Validates CSRF for state-mutating API routes.
// Token must be sent in header: x-csrf-token
// Exempt: GET, HEAD, OPTIONS (safe methods)
// Exempt: /api/auth (handles its own security via rate limiting + body parsing)
export function isCsrfExempt(method: string, pathname: string): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) return true
  if (pathname.startsWith('/api/auth')) return true
  if (pathname.startsWith('/api/health')) return true
  if (pathname.startsWith('/api/inngest')) return true
  return false
}
