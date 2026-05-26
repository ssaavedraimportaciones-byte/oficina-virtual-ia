import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PREFIXES = [
  '/api/health',
  '/api/verify',
  '/health',
  '/login',
  '/unauthorized',
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
  '/icons',
  '/images',
]

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // TEMPORAL PARA STAGING: no validar JWT aquí.
  // La autorización real queda en route handlers.
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
