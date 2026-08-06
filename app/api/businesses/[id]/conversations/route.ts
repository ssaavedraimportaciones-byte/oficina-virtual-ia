import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createConversation, getBusiness, listConversations } from '@/lib/store'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (!(await getBusiness(id))) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const conversation = await createConversation({ businessId: id, ...parsed.data })
  return NextResponse.json({ conversation })
}
