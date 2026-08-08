import { NextResponse } from 'next/server'
import { appUrl } from '@/lib/auth'
import { createUpgradeCheckout } from '@/lib/billing'
import { requireUser } from '@/lib/authz'
import { prisma } from '@/lib/db'

export async function POST() {
  const user = await requireUser()
  if (user instanceof NextResponse) return user

  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
  const result = await createUpgradeCheckout(
    { id: user.id, email: user.email, stripeCustomerId: row.stripeCustomerId },
    `${appUrl()}/account?upgrade=ok`,
    `${appUrl()}/account?upgrade=cancelado`,
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 503 })
  }
  return NextResponse.json({ url: result.url })
}
