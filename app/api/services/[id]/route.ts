import { NextResponse } from 'next/server'
import { deleteService } from '@/lib/store'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteService(id)
  return NextResponse.json({ ok: true })
}
