import { callClassifyDocument, callExtractFields, computeMissingFields } from './client'
import { DOCUMENT_FIELD_SCHEMAS } from './prompts'
import type { AIClassificationResult, DocumentType } from './types'

export type { AIClassificationResult, DocumentType }

/**
 * Classifies a document from its extracted text and returns structured result
 * with type, confidence, fields, missing fields, and observations.
 */
export async function classifyDocument(fileText: string): Promise<AIClassificationResult> {
  if (!fileText || fileText.trim().length < 10) {
    return {
      documentType: 'OTHER',
      confidence: 0,
      fields: {},
      missingFields: [],
      observations: ['El texto extraído es demasiado corto para clasificar el documento.'],
      inferredFields: [],
    }
  }

  return callClassifyDocument(fileText)
}

/**
 * Detects only the document type and confidence without full field extraction.
 * Faster than classifyDocument when only the type is needed.
 */
export async function detectDocumentType(
  fileText: string
): Promise<{ documentType: DocumentType; confidence: number }> {
  const result = await callClassifyDocument(fileText)
  return { documentType: result.documentType, confidence: result.confidence }
}

/**
 * Given a known document type and raw text, extracts and maps fields
 * according to that type's schema, marking inferred values.
 */
export async function mapExtractedFieldsToSchema(
  documentType: DocumentType,
  extractedText: string
): Promise<AIClassificationResult> {
  return callExtractFields(documentType, extractedText)
}

/**
 * Checks which required fields are missing or null for a given document type.
 */
export function detectMissingFields(
  documentType: DocumentType,
  fields: Record<string, { value: string | null; inferred: boolean }>
): string[] {
  return computeMissingFields(documentType, fields)
}

/**
 * Generates initial observations about the document's quality and completeness.
 */
export async function generateInitialObservations(
  documentData: Partial<AIClassificationResult>
): Promise<string[]> {
  const observations: string[] = [...(documentData.observations ?? [])]

  const { documentType, fields = {}, missingFields = [], confidence = 0 } = documentData

  if (confidence < 0.5) {
    observations.push(
      `Clasificación de baja confianza (${Math.round(confidence * 100)}%). Se recomienda revisión manual del tipo de documento.`
    )
  }

  if (missingFields.length > 0) {
    observations.push(
      `Campos requeridos faltantes: ${missingFields.join(', ')}. El documento puede estar incompleto.`
    )
  }

  if (documentType && documentType !== 'OTHER') {
    const schema = DOCUMENT_FIELD_SCHEMAS[documentType]
    const requiredCount = schema.filter((f) => f.required).length
    const presentCount = schema.filter(
      (f) => f.required && fields[f.name]?.value !== null && fields[f.name]?.value !== undefined
    ).length

    if (requiredCount > 0 && presentCount < requiredCount) {
      const pct = Math.round((presentCount / requiredCount) * 100)
      observations.push(
        `Completitud de campos requeridos: ${pct}% (${presentCount}/${requiredCount}).`
      )
    }
  }

  const inferredCount = documentData.inferredFields?.length ?? 0
  if (inferredCount > 0) {
    observations.push(
      `${inferredCount} campo(s) con valor inferido. Verificar que los datos sean correctos.`
    )
  }

  return [...new Set(observations)]
}
