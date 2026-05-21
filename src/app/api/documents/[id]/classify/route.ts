import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import {
  classifyDocument,
  mapExtractedFieldsToSchema,
  detectMissingFields,
  generateInitialObservations,
  type DocumentType,
} from '@/modules/ai-validation'
import { log } from '@/modules/audit'
import { requireAuth, getIp } from '@/app/api/_lib/auth-middleware'

interface Params {
  params: { id: string }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = params
  const auth = requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth
  const ip = getIp(req)
  const ua = req.headers.get('user-agent') ?? ''

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

    await log(
      { userId: user.uid, ip, userAgent: ua },
      'AI_CLASSIFICATION_EXECUTED',
      {
        documentId: id,
        metadata: {
          documentType: result.documentType,
          confidence: result.confidence,
          missingFields: result.missingFields,
          forced: !!forceType,
        },
      }
    )

    return NextResponse.json({ ok: true, documentId: id, classification: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al clasificar el documento'
    console.error('[classify]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
