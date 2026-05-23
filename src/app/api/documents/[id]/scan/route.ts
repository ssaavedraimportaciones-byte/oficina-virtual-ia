import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { requirePermission, requireAuth, getIp } from '@/app/api/_lib/auth-middleware'
import { uploadDocument } from '@/modules/ocr'
import { log } from '@/modules/audit'
import { validateAllowedUpload } from '@/lib/file-validation'
import { enqueueOcr } from '@/lib/jobs'

// POST /api/documents/[id]/scan
// Accepts multipart/form-data with:
//   - file: the document image or PDF
//   - forceOverwrite: 'true' to overwrite conflicting manual fields
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = requirePermission(req, 'documents:create')
  if ('error' in result) return result.error

  const { user } = result
  const ip = getIp(req)
  const ua = req.headers.get('user-agent') ?? ''

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, companyId: true, createdById: true, status: true },
  })

  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  if (user.role === 'WORKER' && doc.createdById !== user.uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const LOCKED = ['APPROVED', 'CLOSED', 'ARCHIVED']
  if (LOCKED.includes(doc.status)) {
    await log({ userId: user.uid, ip, userAgent: ua }, 'DOCUMENT_SCANNED', {
      documentId: id,
      metadata: { blocked: true, reason: 'document_locked', status: doc.status },
    })
    return NextResponse.json(
      { error: `No se puede re-escanear un documento en estado "${doc.status}"` },
      { status: 422 }
    )
  }

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
  const buffer = Buffer.from(await file.arrayBuffer())

  const fileValidation = validateAllowedUpload(buffer, file.type)
  if (!fileValidation.valid) {
    await log({ userId: user.uid, ip, userAgent: ua }, 'DOCUMENT_SCANNED', {
      documentId: id,
      metadata: { blocked: true, reason: fileValidation.reason, declaredMimeType: file.type, fileSize: buffer.length },
    })
    return NextResponse.json(
      { error: 'Archivo no permitido. Solo se aceptan PDF, PNG o JPG válidos.' },
      { status: 400 }
    )
  }

  // Upload file to storage BEFORE returning 202 — scannedFileUrl set immediately,
  // payload stored in Job so worker can read from storage without the buffer in memory.
  const uploaded = await uploadDocument({
    buffer,
    originalName: file.name,
    mimeType: file.type,
    documentId: id,
    userId: user.uid,
    ip,
    userAgent: ua,
  })

  const job = await enqueueOcr(id, user.uid, {
    storageUrl: uploaded.storageUrl,
    fileName: file.name,
    mimeType: file.type,
    forceOverwrite,
    ip,
    userAgent: ua,
  })

  await log({ userId: user.uid, ip, userAgent: ua }, 'OCR_JOB_CREATED', {
    documentId: id,
    metadata: { jobId: job.id, fileName: file.name, mimeType: file.type, fileSize: buffer.length },
  })

  return NextResponse.json({ ok: true, jobId: job.id, status: 'pending' }, { status: 202 })
}

// GET /api/documents/[id]/scan — current scan state
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = requireAuth(req)
  if ('error' in result) return result.error
  const { user } = result

  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true, folio: true, status: true, scannedFileUrl: true, aiResult: true,
      fields: {
        orderBy: { fieldName: 'asc' },
        select: { fieldName: true, fieldValue: true, confidence: true, isRequired: true, isValid: true },
      },
    },
  })

  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  if (user.role === 'WORKER') {
    const full = await prisma.document.findUnique({ where: { id }, select: { createdById: true } })
    if (full?.createdById !== user.uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ document: doc })
}
