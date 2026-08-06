import { NextResponse } from 'next/server'
import { deleteKnowledgeEntry } from '@/lib/store'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await deleteKnowledgeEntry(id)
  return NextResponse.json({ ok: true })
}
