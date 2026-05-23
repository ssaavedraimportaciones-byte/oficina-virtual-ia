import { NextRequest, NextResponse } from 'next/server'
import { generateCsrfToken } from '@/lib/csrf'

// GET /api/auth/csrf — returns a CSRF token for the current session
// Frontend should request this on page load and include it as x-csrf-token header
// in all state-mutating requests (POST, PATCH, DELETE)
export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const token = await generateCsrfToken(userId)
  return NextResponse.json({ csrfToken: token })
}
