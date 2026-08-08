import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { addBusinessMember } from '@/lib/auth'
import { requireUser } from '@/lib/authz'
import { canOwnAnotherBusiness } from '@/lib/billing'
import { createBusiness, listBusinessesForUser } from '@/lib/store'
import { toPublicBusiness } from '@/lib/publicBusiness'
import { agentConfigSchema } from '@/lib/validation'

export async function GET() {
  const user = await requireUser()
  if (user instanceof NextResponse) return user

  const businesses = await listBusinessesForUser(user)
  return NextResponse.json({ businesses: businesses.map(toPublicBusiness) })
}

const createSchema = z.object({
  templateId: z.string().min(1),
  config: agentConfigSchema,
})

export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (user instanceof NextResponse) return user

  if (!(await canOwnAnotherBusiness(user.id, user.role))) {
    return NextResponse.json(
      { error: 'El plan gratuito permite un solo negocio propio. Pasate a PRO para crear más.' },
      { status: 402 },
    )
  }

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const business = await createBusiness(
    { ...parsed.data.config, configuredAt: new Date().toISOString() },
    parsed.data.templateId,
  )

  // Quien crea el negocio queda como dueño automáticamente; el admin de
  // plataforma ya lo ve igual (ve todos), así que no necesita esta fila.
  await addBusinessMember(user.id, business.id, 'OWNER')

  return NextResponse.json({ business: toPublicBusiness(business) })
}
