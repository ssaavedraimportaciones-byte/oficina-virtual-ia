import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { addKnowledgeEntry, getBusiness, refreshKnowledgeEntry } from '@/lib/store'
import { importPageText } from '@/lib/webImport'

const importSchema = z.object({
  url: z.string().url(),
  entryId: z.string().optional(),
})

// Importa (o reimporta) el texto de una página web como entrada de
// conocimiento, para que el agente pueda responder con esos datos (ej: lista
// de precios publicada en el sitio).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const parsed = importSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (!(await getBusiness(id))) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  let page: { title: string; text: string }
  try {
    page = await importPageText(parsed.data.url)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo importar la página' },
      { status: 502 },
    )
  }

  const entry = parsed.data.entryId
    ? await refreshKnowledgeEntry(parsed.data.entryId, { title: page.title, content: page.text })
    : await addKnowledgeEntry({
        businessId: id,
        title: page.title,
        content: page.text,
        sourceType: 'web',
        sourceUrl: parsed.data.url,
      })

  return NextResponse.json({ entry })
}
