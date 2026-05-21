import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { requirePermission, requireAuth, getIp } from '@/app/api/_lib/auth-middleware'
import {
  uploadDocument,
  runOCR,
  extractFields,
  persistFields,
} from '@/modules/ocr'
import { log } from '@/modules/audit'

// POST /api/documents/[id]/scan
// Accepts multipart/form-data with:
//   - file: the document image or PDF
//   - forceOverwrite: 'true' to overwrite conflicting manual fields
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = requirePermission(req, 'documents:create')
  if ('error' in result) return result.error

  const { user } = result
  const ip = getIp(req)
  const ua = req.headers.get('user-agent') ?? ''

  // Verify document exists and belongs to user's company
  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: { id: true, companyId: true, createdById: true, status: true },
  })

  if (!doc) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  if (user.role === 'WORKER' && doc.createdById !== user.uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const LOCKED_STATUSES = ['APPROVED', 'CLOSED', 'ARCHIVED']
  if (LOCKED_STATUSES.includes(doc.status)) {
    await log(
      { userId: user.uid, ip, userAgent: ua },
      'DOCUMENT_SCANNED',
      {
        documentId: params.id,
        metadata: { blocked: true, reason: 'document_locked', status: doc.status },
      }
    )
    return NextResponse.json(
      { error: `No se puede re-escanear un documento en estado "${doc.status}"` },
      { status: 422 }
    )
  }

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Formato inválido: se esperaba multipart/form-data' }, { status: 400 })
  }

  const fileEntry = formData.get('file')
  if (!fileEntry || typeof fileEntry === 'string') {
    return NextResponse.json({ error: 'Campo "file" requerido' }, { status: 400 })
  }

  const file = fileEntry as File
  const forceOverwrite = formData.get('forceOverwrite') === 'true'

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  try {
    // 1. Store original file
    const uploaded = await uploadDocument({
      buffer,
      originalName: file.name,
      mimeType: file.type,
      documentId: params.id,
      userId: user.uid,
      ip,
      userAgent: ua,
    })

    // 2. Run OCR
    const ocrResult = await runOCR({
      buffer,
      mimeType: file.type,
      documentId: params.id,
      userId: user.uid,
      ip,
      userAgent: ua,
    })

    // 3. Persist fields, detect conflicts with manual entries
    const fields = extractFields(ocrResult)
    const { conflicts, saved } = await persistFields({
      documentId: params.id,
      fields,
      userId: user.uid,
      ip,
      userAgent: ua,
      forceOverwrite,
    })

    await log(
      { userId: user.uid, ip, userAgent: ua },
      'DOCUMENT_SCANNED',
      {
        documentId: params.id,
        metadata: { fileName: file.name, mimeType: file.type, fileSize: buffer.length, storageUrl: uploaded.storageUrl },
      }
    )
    await log(
      { userId: user.uid, ip, userAgent: ua },
      'OCR_EXECUTED',
      {
        documentId: params.id,
        metadata: {
          averageConfidence: ocrResult.averageConfidence,
          pageCount: ocrResult.pageCount,
          fieldsExtracted: fields.length,
          requiresHumanReview: ocrResult.requiresHumanReview,
          conflicts: conflicts.length,
        },
      }
    )

    return NextResponse.json({
      ok: true,
      fileUrl: uploaded.storageUrl,
      ocr: {
        rawText: ocrResult.rawText,
        fields: ocrResult.fields,
        tables: ocrResult.tables,
        signatures: ocrResult.signatures,
        averageConfidence: ocrResult.averageConfidence,
        requiresHumanReview: ocrResult.requiresHumanReview,
        hasHandwrittenContent: ocrResult.hasHandwrittenContent,
        pageCount: ocrResult.pageCount,
        language: ocrResult.language,
      },
      fieldsSaved: saved,
      conflicts,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de OCR'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET /api/documents/[id]/scan
// Returns current scan state: fileUrl + aiResult from DB
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = requireAuth(req)
  if ('error' in result) return result.error

  const { user } = result

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      folio: true,
      status: true,
      scannedFileUrl: true,
      aiResult: true,
      fields: {
        orderBy: { fieldName: 'asc' },
        select: {
          fieldName: true,
          fieldValue: true,
          confidence: true,
          isRequired: true,
          isValid: true,
        },
      },
    },
  })

  if (!doc) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  if (user.role === 'WORKER') {
    const full = await prisma.document.findUnique({
      where: { id: params.id },
      select: { createdById: true },
    })
    if (full?.createdById !== user.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return NextResponse.json({ document: doc })
}
