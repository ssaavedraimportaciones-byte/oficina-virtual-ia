import { NextResponse } from 'next/server'
import { revokeSession } from '@/lib/auth'
import { requireUser } from '@/lib/authz'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
  await revokeSession(user.id, id)
  return NextResponse.json({ ok: true })
}
