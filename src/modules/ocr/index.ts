import { prisma } from '@/lib/db/client'
import { log } from '@/modules/audit'
import { storeFile, ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from './storage'
import { runAzureOCR } from './azure'
import { runMockOCR } from './mock'

const AZURE_CONFIGURED = !!(
  process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT &&
  process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY
)
import type { OCRResult, OCRField, OCRTable, SignatureRegion, FieldConflict } from './types'
import { CONFIDENCE_THRESHOLD } from './types'

export { CONFIDENCE_THRESHOLD } from './types'
export type { OCRResult, OCRField, OCRTable, SignatureRegion, FieldConflict }

// ─── uploadDocument ──────────────────────────────────────────────────────────

export async function uploadDocument(params: {
  buffer: Buffer
  originalName: string
  mimeType: string
  documentId: string
  userId: string
  ip?: string
  userAgent?: string
}) {
  const { buffer, originalName, mimeType, documentId, userId, ip, userAgent } = params

  if (!ACCEPTED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Tipo de archivo no permitido: ${mimeType}`)
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Archivo demasiado grande (máx 50 MB)`)
  }

  const uploaded = await storeFile(buffer, originalName, mimeType, documentId)

  await prisma.document.update({
    where: { id: documentId },
    data: { scannedFileUrl: uploaded.storageUrl },
  })

  await log({ userId, ip, userAgent }, 'UPDATE', {
    documentId,
    metadata: {
      action: 'FILE_UPLOAD',
      originalName,
      mimeType,
      sizeBytes: buffer.length,
      storageUrl: uploaded.storageUrl,
    },
  })

  return uploaded
}

// ─── runOCR ──────────────────────────────────────────────────────────────────

export async function runOCR(params: {
  buffer: Buffer
  mimeType: string
  documentId: string
  userId: string
  ip?: string
  userAgent?: string
}): Promise<OCRResult> {
  const { buffer, mimeType, documentId, userId, ip, userAgent } = params

  const result = AZURE_CONFIGURED
    ? await runAzureOCR(buffer, mimeType)
    : runMockOCR(buffer, mimeType)

  await prisma.document.update({
    where: { id: documentId },
    data: {
      aiResult: result as object,
      status: result.requiresHumanReview ? 'OBSERVED' : 'SCANNED',
    },
  })

  await log({ userId, ip, userAgent }, 'UPDATE', {
    documentId,
    metadata: {
      action: 'OCR_COMPLETE',
      averageConfidence: result.averageConfidence,
      requiresHumanReview: result.requiresHumanReview,
      hasHandwrittenContent: result.hasHandwrittenContent,
      pageCount: result.pageCount,
      fieldCount: result.fields.length,
    },
  })

  return result
}

// ─── extractText ─────────────────────────────────────────────────────────────

export function extractText(result: OCRResult): string {
  return result.rawText
}

// ─── extractTables ───────────────────────────────────────────────────────────

export function extractTables(result: OCRResult): OCRTable[] {
  return result.tables
}

// ─── extractFields ───────────────────────────────────────────────────────────

export function extractFields(result: OCRResult): OCRField[] {
  return result.fields
}

// ─── detectSignatures ────────────────────────────────────────────────────────

export function detectSignatures(result: OCRResult): SignatureRegion[] {
  return result.signatures
}

// ─── getConfidenceScores ─────────────────────────────────────────────────────

export function getConfidenceScores(result: OCRResult): Record<string, number> {
  const scores: Record<string, number> = { overall: result.averageConfidence }
  for (const field of result.fields) {
    scores[field.name] = field.confidence
  }
  return scores
}

// ─── persistFields ───────────────────────────────────────────────────────────
// Upsert OCR-extracted fields.
// Returns any conflicts where a manual value already exists (confidence = null).

export async function persistFields(params: {
  documentId: string
  fields: OCRField[]
  userId: string
  ip?: string
  userAgent?: string
  forceOverwrite?: boolean
}): Promise<{ conflicts: FieldConflict[]; saved: number }> {
  const { documentId, fields, userId, ip, userAgent, forceOverwrite = false } = params

  const existing = await prisma.documentField.findMany({ where: { documentId } })
  const existingMap = new Map(existing.map((f) => [f.fieldName, f]))

  const conflicts: FieldConflict[] = []
  let saved = 0

  for (const field of fields) {
    const current = existingMap.get(field.name)

    // Manual field (no confidence) → flag conflict, skip unless forceOverwrite
    if (current && current.confidence === null && current.fieldValue !== null) {
      conflicts.push({
        fieldName: field.name,
        existingValue: current.fieldValue!,
        newValue: field.value,
        newConfidence: field.confidence,
        isManual: true,
      })
      if (!forceOverwrite) continue
    }

    await prisma.documentField.upsert({
      where: { documentId_fieldName: { documentId, fieldName: field.name } },
      create: {
        documentId,
        fieldName: field.name,
        fieldValue: field.value,
        confidence: field.confidence,
        isRequired: false,
        isValid: field.confidence >= CONFIDENCE_THRESHOLD ? true : null,
      },
      update: {
        fieldValue: field.value,
        confidence: field.confidence,
        isValid: field.confidence >= CONFIDENCE_THRESHOLD ? true : null,
      },
    })
    saved++
  }

  if (saved > 0 || conflicts.length > 0) {
    await log({ userId, ip, userAgent }, 'UPDATE', {
      documentId,
      metadata: {
        action: 'OCR_FIELDS_SAVED',
        savedCount: saved,
        conflictCount: conflicts.length,
        forceOverwrite,
      },
    })
  }

  return { conflicts, saved }
}
