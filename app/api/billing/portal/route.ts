import { NextResponse } from 'next/server'
import { appUrl } from '@/lib/auth'
import { createBillingPortalSession } from '@/lib/billing'
import { requireUser } from '@/lib/authz'
import { prisma } from '@/lib/db'

export async function POST() {
  const user = await requireUser()
  if (user instanceof NextResponse) return user

  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
  if (!row.stripeCustomerId) {
    return NextResponse.json({ error: 'Todavía no tenés una suscripción.' }, { status: 400 })
  }

  const result = await createBillingPortalSession(row.stripeCustomerId, `${appUrl()}/account`)
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 503 })
  }
  return NextResponse.json({ url: result.url })
}
