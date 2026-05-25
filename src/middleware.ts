import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { canAccess, getRoutePermission } from '@/lib/permissions'
import { JWT_SECRET } from '@/lib/env'
import type { UserRole } from '@/types/user'

const PUBLIC_PATHS = new Set(['/login', '/unauthorized'])
const PUBLIC_PREFIXES = [
  '/api/auth',
  '/api/verify',
  '/verify',
  '/_next',
  '/icons',
  '/manifest.json',
  '/sw.js',
  '/workbox-',
  '/favicon',
]

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const requestId = crypto.randomUUID()

  if (isPublic(pathname)) {
    const res = NextResponse.next()
    res.headers.set('x-request-id', requestId)
    return res
  }

  const token = req.cookies.get('access_token')?.value

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
    const secretBytes = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jwtVerify(token, secretBytes)

    const role = payload['role'] as UserRole
    const permission = getRoutePermission(pathname)

    if (permission && !canAccess(role, permission)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    const res = NextResponse.next()
    res.headers.set('x-request-id', requestId)
    res.headers.set('x-user-id', String(payload['uid'] ?? ''))
    res.headers.set('x-user-email', String(payload['email'] ?? ''))
    res.headers.set('x-user-name', String(payload['name'] ?? ''))
    res.headers.set('x-user-role', String(payload['role'] ?? ''))
    res.headers.set('x-user-company', String(payload['companyId'] ?? ''))
    return res
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
