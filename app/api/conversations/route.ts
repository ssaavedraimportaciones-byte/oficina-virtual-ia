import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createConversation, listConversations } from '@/lib/store'

export async function GET() {
  const conversations = await listConversations()
  return NextResponse.json({ conversations })
}

const createSchema = z.object({
  channel: z.enum(['whatsapp', 'instagram', 'simulador']),
  contactName: z.string().min(1),
  contactHandle: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const conversation = await createConversation(parsed.data)
  return NextResponse.json({ conversation })
}
