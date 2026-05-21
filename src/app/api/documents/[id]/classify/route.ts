import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import {
  classifyDocument,
  mapExtractedFieldsToSchema,
  detectMissingFields,
  generateInitialObservations,
  type DocumentType,
} from '@/modules/ai-validation'

interface Params {
  params: { id: string }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = params

  try {
    const doc = await prisma.document.findUnique({
      where: { id },
      include: { fields: true },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const forceType: DocumentType | undefined = body.documentType

    // Build text from existing OCR fields + any raw text passed in body
    const fieldText = doc.fields
      .map((f) => `${f.fieldName}: ${f.fieldValue ?? ''}`)
      .join('\n')
    const rawText: string = body.rawText ?? fieldText

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: 'No hay texto disponible para clasificar. Escanea el documento primero.' },
        { status: 422 }
      )
    }

    let result
    if (forceType) {
      result = await mapExtractedFieldsToSchema(forceType, rawText)
    } else {
      result = await classifyDocument(rawText)
    }

    const missingFields = detectMissingFields(result.documentType, result.fields)
    result.missingFields = missingFields

    const observations = await generateInitialObservations(result)
    result.observations = observations

    return NextResponse.json({
      ok: true,
      documentId: id,
      classification: result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al clasificar el documento'
    console.error('[classify]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
