import { NextResponse } from 'next/server'
import { requireBusinessAccess } from '@/lib/authz'
import { deleteProfessional, getProfessionalBusinessId } from '@/lib/store'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = await getProfessionalBusinessId(id)
  if (!businessId) return NextResponse.json({ ok: true })

  const user = await requireBusinessAccess(businessId)
  if (user instanceof NextResponse) return user

  await deleteProfessional(id)
  return NextResponse.json({ ok: true })
}
