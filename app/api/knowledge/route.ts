import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { addKnowledgeEntry, listKnowledge } from '@/lib/store'

export async function GET() {
  const knowledge = await listKnowledge()
  return NextResponse.json({ knowledge })
}

const createSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const entry = await addKnowledgeEntry({ ...parsed.data, sourceType: 'manual', sourceUrl: null })
  return NextResponse.json({ entry })
}
