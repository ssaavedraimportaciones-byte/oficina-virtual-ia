import { NextRequest, NextResponse } from 'next/server'

// Temporary staging-only debug endpoint.
// Reveals whether proxy.ts injected x-user-* headers — no secrets exposed.
export async function GET(req: NextRequest) {
  const allHeaders = Array.from(req.headers.keys())

  return NextResponse.json({
    hasCookieHeader: req.headers.has('cookie'),
    hasAccessTokenCookie:
      req.cookies.has('access_token') ||
      /(?:^|;\s*)access_token=/.test(req.headers.get('cookie') ?? ''),
    hasXUserId: req.headers.has('x-user-id'),
    hasXUserEmail: req.headers.has('x-user-email'),
    hasXUserRole: req.headers.has('x-user-role'),
    hasXUserCompany: req.headers.has('x-user-company'),
    xUserIdPresent: (req.headers.get('x-user-id') ?? '').length > 0,
    xUserRoleValue: req.headers.get('x-user-role') ?? null,
    headerNames: allHeaders.filter((h) => h.startsWith('x-')),
  })
}
