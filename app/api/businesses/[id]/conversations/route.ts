import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBusinessAccess } from '@/lib/authz'
import { createConversation, deleteConversations, listConversations } from '@/lib/store'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const conversations = await listConversations(id)
  return NextResponse.json({ conversations })
}

const createSchema = z.object({
  channel: z.enum(['whatsapp', 'instagram', 'simulador']),
  contactName: z.string().min(1),
  contactHandle: z.string().min(1),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const conversation = await createConversation({ businessId: id, ...parsed.data })
  return NextResponse.json({ conversation })
}

const deleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(500) })

/** Borra las conversaciones elegidas en el panel. Body: { ids: string[] }. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Elige al menos una conversación.' }, { status: 400 })
  }

  const deleted = await deleteConversations(id, parsed.data.ids)
  return NextResponse.json({ deleted })
}
