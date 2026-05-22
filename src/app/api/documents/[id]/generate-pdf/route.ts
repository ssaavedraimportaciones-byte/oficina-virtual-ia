import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { requirePermission, getIp } from '@/app/api/_lib/auth-middleware'
import { generateFinalPdf } from '@/modules/pdf'
import { log } from '@/modules/audit'
import { getJobQueue } from '@/modules/jobs'

const PDF_ERROR_GENERIC = 'PDF no pudo generarse. Intente nuevamente o contacte soporte.'

interface Params {
  params: { id: string }
}

/**
 * POST /api/documents/[id]/generate-pdf
 *
 * Returns 202 immediately with a jobId.
 * The PDF is generated asynchronously by runPdfWorker().
 * Poll GET /api/documents/[id]/generate-pdf/status?jobId=<uuid> for the result.
 *
 * Idempotency: if the document already has a finalPdfUrl, returns 200 with the
 * existing URL. Pass { force: true } in the request body (SYSTEM_ADMIN only)
 * to trigger regeneration.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = requirePermission(req, 'documents:approve')
  if ('error' in auth) return auth.error
  const { user } = auth
  const ip = getIp(req)
  const ua = req.headers.get('user-agent') ?? ''

  // Parse optional body — body is not required
  let force = false
  try {
    const body = await req.json()
    force = body?.force === true
  } catch { /* body omitted — that is fine */ }

  // force=true is restricted to SYSTEM_ADMIN to prevent unauthorised regeneration
  if (force && user.role !== 'SYSTEM_ADMIN') {
    return NextResponse.json(
      { error: 'Solo SYSTEM_ADMIN puede regenerar un PDF existente.' },
      { status: 403 }
    )
  }

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, finalPdfUrl: true },
  })

  if (!doc) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  if (doc.status !== 'APPROVED') {
    return NextResponse.json(
      { error: `Solo se puede generar PDF de documentos APPROVED (estado actual: ${doc.status})` },
      { status: 422 }
    )
  }

  // Idempotency: return existing PDF without enqueuing a new job
  if (doc.finalPdfUrl && !force) {
    return NextResponse.json({
      ok: true,
      jobId: null,
      status: 'completed',
      finalPdfUrl: doc.finalPdfUrl,
      message: 'PDF ya generado. Use force=true con permisos SYSTEM_ADMIN para regenerar.',
    })
  }

  const job = getJobQueue().enqueue(params.id, user.uid)

  try {
    await log(
      { userId: user.uid, ip, userAgent: ua },
      'PDF_JOB_CREATED',
      { documentId: params.id, metadata: { jobId: job.id, force } }
    )
  } catch { /* audit failure must not block the 202 response */ }

  // Snapshot primitives before the request object closes
  const userId = user.uid
  const documentId = params.id

  // Start async worker — runs in-process after response is sent.
  // DEBT: setImmediate does not survive serverless function freeze.
  //       Use next/server after() or BullMQ/Inngest for multi-instance deployments.
  setImmediate(() => {
    runPdfWorker({ jobId: job.id, documentId, userId, ip, ua })
  })

  return NextResponse.json(
    { ok: true, jobId: job.id, status: 'pending', message: 'Generación de PDF iniciada' },
    { status: 202 }
  )
}

async function runPdfWorker(params: {
  jobId: string
  documentId: string
  userId: string
  ip: string
  ua: string
}): Promise<void> {
  const { jobId, documentId, userId, ip, ua } = params
  const queue = getJobQueue()

  queue.update(jobId, { status: 'running', startedAt: Date.now() })
  try {
    await log({ userId, ip, userAgent: ua }, 'PDF_JOB_STARTED', {
      documentId,
      metadata: { jobId },
    })
  } catch { /* audit failure must not abort PDF generation */ }

  try {
    const result = await generateFinalPdf(documentId, userId, ip)

    queue.update(jobId, {
      status: 'completed',
      completedAt: Date.now(),
      result: {
        finalPdfUrl: result.pdfUrl,
        qrCode: result.qrCode,
        documentHash: result.documentHash,
        version: result.version,
      },
    })
    try {
      await log({ userId, ip, userAgent: ua }, 'PDF_JOB_COMPLETED', {
        documentId,
        metadata: {
          jobId,
          pdfUrl: result.pdfUrl,
          version: result.version,
          documentHash: result.documentHash,
        },
      })
    } catch { /* audit failure must not surface externally */ }
  } catch {
    queue.update(jobId, {
      status: 'failed',
      completedAt: Date.now(),
      error: PDF_ERROR_GENERIC,
    })
    try {
      await log({ userId, ip, userAgent: ua }, 'PDF_JOB_FAILED', {
        documentId,
        metadata: { jobId },
      })
    } catch { /* audit failure must not surface externally */ }
  }
}
