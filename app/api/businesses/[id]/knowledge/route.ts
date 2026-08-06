import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { addKnowledgeEntry, getBusiness, listKnowledge } from '@/lib/store'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const knowledge = await listKnowledge(id)
  return NextResponse.json({ knowledge })
}

const createSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
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

  const entry = await addKnowledgeEntry({
    businessId: id,
    ...parsed.data,
    sourceType: 'manual',
    sourceUrl: null,
  })
  return NextResponse.json({ entry })
}
