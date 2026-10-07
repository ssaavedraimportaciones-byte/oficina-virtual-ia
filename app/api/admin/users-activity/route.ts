import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, isPlatformAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !isPlatformAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const allUsers = await prisma.user.findMany({
    include: {
      sessions: {
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      memberships: {
        select: { businessId: true },
      },
    },
  })

  const users = allUsers.map((u) => {
    const lastSession = u.sessions[0]?.createdAt
    const lastActivityDays = lastSession
      ? Math.floor((now.getTime() - lastSession.getTime()) / (24 * 60 * 60 * 1000))
      : 999

    const registeredDays = Math.floor(
      (now.getTime() - u.createdAt.getTime()) / (24 * 60 * 60 * 1000),
    )

    const isActive =
      lastActivityDays <= 7 || (u.sessions.length > 0 && lastActivityDays <= 30)

    return {
      id: u.id,
      email: u.email,
      role: u.role,
      registeredDays,
      lastActivityDays: lastActivityDays === 999 ? 999 : lastActivityDays,
      sessionCount: u.sessions.length,
      businessCount: u.memberships.length,
      status: isActive ? 'active' : 'inactive',
    }
  })

  return NextResponse.json({ users })
}
