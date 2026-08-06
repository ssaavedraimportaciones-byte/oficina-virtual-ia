import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { describeApiError, generateAgentReply } from '@/lib/agentEngine'
import { requireBusinessAccess } from '@/lib/authz'
import { updateContactNotes } from '@/lib/contactNotes'
import {
  appendMessage,
  getBusiness,
  getConversation,
  listKnowledge,
  listProducts,
  listServices,
} from '@/lib/store'

const messageSchema = z.object({
  sender: z.enum(['contact', 'human']),
  text: z.string().min(1),
})

// Usado por el simulador del panel: mandás un mensaje "como si fueras el
// contacto" y, si corresponde, el agente responde de verdad con Claude usando
// la configuración del negocio dueño de la conversación. Los webhooks de
// WhatsApp/Instagram usan lib/agentPipeline.ts en lugar de esta ruta.
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

  const user = await requireBusinessAccess(conversation.businessId)
  if (user instanceof NextResponse) return user

  conversation = await appendMessage(conversation.id, parsed.data)

  if (parsed.data.sender === 'human') {
    return NextResponse.json({ conversation })
  }

  const business = await getBusiness(conversation.businessId)
  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  try {
    const [knowledge, services, products] = await Promise.all([
      listKnowledge(business.id),
      listServices(business.id),
      listProducts(business.id),
    ])
    const reply = await generateAgentReply(business.config, knowledge, conversation.messages, {
      services,
      products,
      toolContext: { business, conversation },
    })
    conversation = await appendMessage(conversation.id, { sender: 'agent', text: reply })
    conversation = await updateContactNotes(conversation)
  } catch (error) {
    return NextResponse.json({ conversation, error: describeApiError(error) }, { status: 502 })
  }

  return NextResponse.json({ conversation })
}
