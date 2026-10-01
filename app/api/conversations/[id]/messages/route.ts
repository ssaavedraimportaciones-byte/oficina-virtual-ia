import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { describeApiError, generateAgentReply } from '@/lib/agentEngine'
import { requireBusinessAccess } from '@/lib/authz'
import { updateContactNotes } from '@/lib/contactNotes'
import { sendHumanReply } from '@/lib/humanReply'
import { getMaintenance } from '@/lib/platform'
import { getAgentUsage, quotaMessage } from '@/lib/usage'
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
  text: z.string().trim().min(1).max(4000),
})

// - sender "human": una persona del equipo le responde al contacto. Sale por
//   WhatsApp/Instagram de verdad y pausa al agente en esta conversación.
// - sender "contact": solo en el simulador del panel, para probar al agente
//   escribiendo "como si fueras el cliente". En una conversación real el
//   contacto escribe por su canal y entra por los webhooks (lib/agentPipeline.ts).
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

  const business = await getBusiness(conversation.businessId)
  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  if (parsed.data.sender === 'human') {
    try {
      conversation = await sendHumanReply(business, conversation, parsed.data.text)
    } catch (error) {
      return NextResponse.json(
        {
          conversation,
          error: `No se pudo enviar el mensaje: ${error instanceof Error ? error.message : 'error desconocido'}`,
        },
        { status: 502 },
      )
    }
    return NextResponse.json({ conversation })
  }

  if (conversation.channel !== 'simulador') {
    return NextResponse.json(
      { error: 'Solo se puede escribir como el cliente en el simulador.' },
      { status: 400 },
    )
  }

  conversation = await appendMessage(conversation.id, { sender: 'contact', text: parsed.data.text })
  if (conversation.agentPaused) {
    return NextResponse.json({ conversation })
  }

  const maintenance = await getMaintenance()
  if (maintenance.enabled) {
    return NextResponse.json(
      { conversation, error: 'El agente está en mantenimiento por unos minutos. Vuelve a intentarlo en un rato.' },
      { status: 503 },
    )
  }

  const usage = await getAgentUsage(business.id)
  if (usage.exceeded) {
    return NextResponse.json({ conversation, error: quotaMessage(usage) }, { status: 429 })
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
      contactNotes: conversation.notes,
    })
    conversation = await appendMessage(conversation.id, { sender: 'agent', text: reply })
    conversation = await updateContactNotes(conversation)
  } catch (error) {
    return NextResponse.json({ conversation, error: describeApiError(error) }, { status: 502 })
  }

  return NextResponse.json({ conversation })
}
