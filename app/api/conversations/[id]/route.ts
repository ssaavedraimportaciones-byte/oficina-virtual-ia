import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBusinessAccess } from '@/lib/authz'
import { getConversation, setAgentPaused } from '@/lib/store'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const conversation = await getConversation(id)
  if (!conversation) {
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  }

  const user = await requireBusinessAccess(conversation.businessId)
  if (user instanceof NextResponse) return user

  return NextResponse.json({ conversation })
}

const patchSchema = z.object({ agentPaused: z.boolean() })

/** Pausar al agente para atender a mano, o devolverle la conversación. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const parsed = patchSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const conversation = await getConversation(id)
  if (!conversation) {
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  }

  const user = await requireBusinessAccess(conversation.businessId)
  if (user instanceof NextResponse) return user

  const updated = await setAgentPaused(
    id,
    parsed.data.agentPaused,
    parsed.data.agentPaused ? 'La tomó una persona del equipo.' : '',
  )
  return NextResponse.json({ conversation: updated })
}
