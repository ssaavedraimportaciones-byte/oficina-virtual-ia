import { NextResponse } from 'next/server'
import { requireBusinessAccess } from '@/lib/authz'
import { deleteKnowledgeEntry, getKnowledgeEntryBusinessId } from '@/lib/store'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const businessId = await getKnowledgeEntryBusinessId(id)
  if (!businessId) return NextResponse.json({ ok: true })

  const user = await requireBusinessAccess(businessId)
  if (user instanceof NextResponse) return user

  await deleteKnowledgeEntry(id)
  return NextResponse.json({ ok: true })
}
