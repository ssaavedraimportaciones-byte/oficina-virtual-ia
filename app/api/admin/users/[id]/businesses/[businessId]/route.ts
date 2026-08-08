import { NextResponse } from 'next/server'
import { removeBusinessMember } from '@/lib/auth'
import { requirePlatformAdmin } from '@/lib/authz'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; businessId: string }> },
) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin

  const { id, businessId } = await params
  await removeBusinessMember(id, businessId)
  return NextResponse.json({ ok: true })
}
