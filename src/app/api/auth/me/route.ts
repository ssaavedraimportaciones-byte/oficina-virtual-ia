import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { requireAuth } from '@/app/api/_lib/auth-middleware'

export async function GET(req: NextRequest) {
  const result = requireAuth(req)
  if ('error' in result) return result.error

  const user = await prisma.user.findUnique({
    where: { id: result.user.uid },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      companyId: true,
      isActive: true,
      rut: true,
      phone: true,
    },
  })

  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ user })
}
