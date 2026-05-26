import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { canAccess, getRoutePermission } from '@/lib/permissions'
import type { UserRole } from '@/types/user'

// JWT_SECRET is lazy-loaded inside the handler — never at module level.
// Module-level env validation crashes Edge Runtime on every request when
// the var is absent, blocking even public routes. Lazy load preserves
// the fail-hard invariant only for requests that actually need auth.
function getJwtSecretBytes(): Uint8Array {
  const s = process.env.JWT_SECRET ?? ''
  if (s.length < 32) throw new Error('[proxy] JWT_SECRET not set or too short')
  return new TextEncoder().encode(s)
}

// Exact-match public paths (no auth needed)
// '/api/auth' is EXACT so /api/auth/me, /api/auth/csrf, /api/auth/mfa/* remain protected
const PUBLIC_PATHS = new Set(['/login', '/unauthorized', '/health', '/api/auth'])
const PUBLIC_PREFIXES = [
  '/api/health',
  '/api/verify',
  '/verify',
  '/health',
  '/_next',
  '/icons',
  '/images',
  '/manifest.json',
  '/sw.js',
  '/workbox-',
  '/favicon',
]

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const requestId = crypto.randomUUID()

  // Public routes — pass through without auth
  if (isPublic(pathname)) {
    const pubHeaders = new Headers(req.headers)
    pubHeaders.set('x-request-id', requestId)
    return NextResponse.next({ request: { headers: pubHeaders } })
  }

  // Read access token from cookie
  // Try req.cookies first (Edge Runtime native), then raw Cookie header as fallback
  const token =
    req.cookies.get('access_token')?.value ??
    req.headers.get('cookie')?.match(/(?:^|;\s*)access_token=([^;]+)/)?.[1]

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  try {
    const secretBytes = getJwtSecretBytes()
    const { payload } = await jwtVerify(token, secretBytes)

    const role = payload['role'] as UserRole
    const permission = getRoutePermission(pathname)

    if (permission && !canAccess(role, permission)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    // Inject verified identity into the *request* headers so route handlers
    // can read them via requireAuth(). NextResponse.next({ request: { headers } })
    // is the only correct way — res.headers.set() only affects response headers
    // (what the client sees), never what the downstream route handler reads.
    const reqHeaders = new Headers(req.headers)
    reqHeaders.set('x-request-id', requestId)
    reqHeaders.set('x-user-id', String(payload['uid'] ?? ''))
    reqHeaders.set('x-user-email', String(payload['email'] ?? ''))
    reqHeaders.set('x-user-name', String(payload['name'] ?? ''))
    reqHeaders.set('x-user-role', String(payload['role'] ?? ''))
    reqHeaders.set('x-user-company', String(payload['companyId'] ?? ''))
    return NextResponse.next({ request: { headers: reqHeaders } })
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
