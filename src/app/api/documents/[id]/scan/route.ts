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
import { validateAllowedUpload } from '@/lib/file-validation'
import { getJobQueue, type JobEntry } from '@/modules/jobs'

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

  // Validate file type by magic bytes before any storage or OCR
  const fileValidation = validateAllowedUpload(buffer, file.type)
  if (!fileValidation.valid) {
    await log(
      { userId: user.uid, ip, userAgent: ua },
      'DOCUMENT_SCANNED',
      {
        documentId: params.id,
        metadata: {
          blocked: true,
          reason: fileValidation.reason,
          declaredMimeType: file.type,
          fileSize: buffer.length,
        },
      }
    )
    return NextResponse.json(
      { error: 'Archivo no permitido. Solo se aceptan PDF, PNG o JPG válidos.' },
      { status: 400 }
    )
  }

  // Enqueue the job and return immediately so the HTTP connection is not held open
  const job = getJobQueue().enqueue(params.id, user.uid)

  await log(
    { userId: user.uid, ip, userAgent: ua },
    'OCR_JOB_CREATED',
    {
      documentId: params.id,
      metadata: {
        jobId: job.id,
        fileName: file.name,
        mimeType: file.type,
        fileSize: buffer.length,
      },
    }
  )

  // Snapshot string values from File before the request closes
  const fileName = file.name
  const fileMime = file.type

  // Start async OCR worker — runs in the same process after response is sent.
  // DEBT: setImmediate does not survive serverless function freeze.
  //       Use next/server `after()` or BullMQ/Inngest for multi-instance deployments.
  setImmediate(() => {
    runOcrWorker({
      jobId: job.id,
      buffer,
      fileName,
      fileMime,
      documentId: params.id,
      userId: user.uid,
      ip,
      ua,
      forceOverwrite,
    })
  })

  return NextResponse.json({ ok: true, jobId: job.id, status: 'pending' }, { status: 202 })
}

async function runOcrWorker(params: {
  jobId: string
  buffer: Buffer
  fileName: string
  fileMime: string
  documentId: string
  userId: string
  ip: string
  ua: string
  forceOverwrite: boolean
}): Promise<void> {
  const { jobId, buffer, fileName, fileMime, documentId, userId, ip, ua, forceOverwrite } = params
  const queue = getJobQueue()

  queue.update(jobId, { status: 'running', startedAt: Date.now() })
  try {
    await log({ userId, ip, userAgent: ua }, 'OCR_JOB_STARTED', {
      documentId,
      metadata: { jobId },
    })
  } catch { /* audit failure must not abort OCR */ }

  try {
    const uploaded = await uploadDocument({
      buffer,
      originalName: fileName,
      mimeType: fileMime,
      documentId,
      userId,
      ip,
      userAgent: ua,
    })

    const ocrResult = await runOCR({
      buffer,
      mimeType: fileMime,
      documentId,
      userId,
      ip,
      userAgent: ua,
    })

    const fields = extractFields(ocrResult)
    const { conflicts, saved } = await persistFields({
      documentId,
      fields,
      userId,
      ip,
      userAgent: ua,
      forceOverwrite,
    })

    queue.update(jobId, { status: 'completed', completedAt: Date.now() })
    try {
      await log({ userId, ip, userAgent: ua }, 'OCR_JOB_COMPLETED', {
        documentId,
        metadata: {
          jobId,
          storageUrl: uploaded.storageUrl,
          averageConfidence: ocrResult.averageConfidence,
          pageCount: ocrResult.pageCount,
          fieldsExtracted: fields.length,
          requiresHumanReview: ocrResult.requiresHumanReview,
          fieldsSaved: saved,
          conflicts: conflicts.length,
        },
      })
    } catch { /* audit failure must not surface externally */ }
  } catch {
    queue.update(jobId, {
      status: 'failed',
      completedAt: Date.now(),
      error: 'Error de procesamiento. Intente nuevamente.',
    })
    try {
      await log({ userId, ip, userAgent: ua }, 'OCR_JOB_FAILED', {
        documentId,
        metadata: { jobId },
      })
    } catch { /* audit failure must not surface externally */ }
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
