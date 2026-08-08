import { NextRequest, NextResponse } from 'next/server'
import { listUserSessions, SESSION_COOKIE } from '@/lib/auth'
import { requireUser } from '@/lib/authz'

export async function GET(request: NextRequest) {
  const user = await requireUser()
  if (user instanceof NextResponse) return user

  // Middleware ya garantizó que esta cookie existe para llegar hasta acá.
  const currentToken = request.cookies.get(SESSION_COOKIE)!.value
  const sessions = await listUserSessions(user.id, currentToken)
  return NextResponse.json({ sessions })
}
