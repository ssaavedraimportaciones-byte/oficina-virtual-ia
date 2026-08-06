import { NextResponse } from 'next/server'
import { deleteUser } from '@/lib/auth'
import { requirePlatformAdmin } from '@/lib/authz'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = await params
  if (id === admin.id) {
    return NextResponse.json({ error: 'No podés eliminar tu propio usuario.' }, { status: 400 })
  }

  await deleteUser(id)
  return NextResponse.json({ ok: true })
}
