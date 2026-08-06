import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateAgentReply } from '@/lib/claude'
import { updateContactNotes } from '@/lib/contactNotes'
import { appendMessage, getConfig, getConversation, listKnowledge } from '@/lib/store'

const messageSchema = z.object({
  sender: z.enum(['contact', 'human']),
  text: z.string().min(1),
})

// Usado por el simulador del panel: mandás un mensaje "como si fueras el
// contacto" y, si corresponde, el agente responde de verdad con Claude usando
// la configuración activa. Los webhooks de WhatsApp/Instagram usan
// lib/agentPipeline.ts en lugar de esta ruta.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json()
  const parsed = messageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  let conversation = await getConversation(id)
  if (!conversation) {
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  }

  conversation = await appendMessage(conversation.id, parsed.data)

  if (parsed.data.sender === 'human') {
    return NextResponse.json({ conversation })
  }

  const config = await getConfig()
  if (!config) {
    return NextResponse.json(
      { error: 'Configurá el agente en /panel/configurar antes de probarlo' },
      { status: 409 },
    )
  }

  try {
    const knowledge = await listKnowledge()
    const reply = await generateAgentReply(config, knowledge, conversation.messages)
    conversation = await appendMessage(conversation.id, { sender: 'agent', text: reply })
    conversation = await updateContactNotes(conversation)
  } catch (error) {
    return NextResponse.json(
      { conversation, error: error instanceof Error ? error.message : 'Error generando respuesta' },
      { status: 502 },
    )
  }

  return NextResponse.json({ conversation })
}
