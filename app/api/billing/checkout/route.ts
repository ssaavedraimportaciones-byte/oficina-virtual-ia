import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { appUrl } from '@/lib/auth'
import { createUpgradeCheckout } from '@/lib/billing'
import { requireUser } from '@/lib/authz'
import { prisma } from '@/lib/db'
import { PAID_PLANS } from '@/lib/plans'

const checkoutSchema = z.object({ plan: z.enum(PAID_PLANS) })

export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (user instanceof NextResponse) return user

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: `Elige uno de estos planes: ${PAID_PLANS.join(', ')}` }, { status: 400 })
  }

  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
  // La implementación se cobra por negocio: se arma la lista de los que son
  // suyos y todavía no la tienen pagada.
  const owned = await prisma.businessMember.findMany({
    where: { userId: user.id, role: 'OWNER' },
    select: { business: { select: { id: true, setupFeePaidAt: true } } },
  })
  const unbilledBusinessIds = owned.filter((m) => !m.business.setupFeePaidAt).map((m) => m.business.id)

  const result = await createUpgradeCheckout(
    { id: user.id, email: user.email, stripeCustomerId: row.stripeCustomerId },
    unbilledBusinessIds,
    parsed.data.plan,
    `${appUrl()}/account?upgrade=ok`,
    `${appUrl()}/account?upgrade=cancelado`,
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 503 })
  }
  return NextResponse.json({ url: result.url })
}
