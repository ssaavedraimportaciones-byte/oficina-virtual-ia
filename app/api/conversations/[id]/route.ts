import { NextResponse } from 'next/server'
import { getConversation } from '@/lib/store'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const conversation = await getConversation(id)
  if (!conversation) {
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  }
  return NextResponse.json({ conversation })
}
