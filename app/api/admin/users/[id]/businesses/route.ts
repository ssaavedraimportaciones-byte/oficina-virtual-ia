import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { addBusinessMember } from '@/lib/auth'
import { requirePlatformAdmin } from '@/lib/authz'
import { getBusiness } from '@/lib/store'

const schema = z.object({
  businessId: z.string().min(1),
  role: z.enum(['OWNER', 'STAFF']).default('OWNER'),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = await params
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (!(await getBusiness(parsed.data.businessId))) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  await addBusinessMember(id, parsed.data.businessId, parsed.data.role)
  return NextResponse.json({ ok: true })
}
