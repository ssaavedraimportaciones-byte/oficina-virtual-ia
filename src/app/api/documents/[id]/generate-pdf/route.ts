import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { requirePermission, getIp } from '@/app/api/_lib/auth-middleware'
import { log } from '@/modules/audit'
import { enqueuePdf } from '@/lib/jobs'

/**
 * POST /api/documents/[id]/generate-pdf
 * Returns 202 + jobId. Poll GET /generate-pdf/status?jobId= for result.
 * Idempotency: returns existing URL if already generated (pass force=true as SYSTEM_ADMIN to regenerate).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = requirePermission(req, 'documents:approve')
  if ('error' in auth) return auth.error
  const { user } = auth
  const ip = getIp(req)
  const ua = req.headers.get('user-agent') ?? ''

  let force = false
  try { force = (await req.json())?.force === true } catch { /* body optional */ }

  if (force && user.role !== 'SYSTEM_ADMIN') {
    return NextResponse.json({ error: 'Solo SYSTEM_ADMIN puede regenerar un PDF existente.' }, { status: 403 })
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, status: true, finalPdfUrl: true },
  })

  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  if (doc.status !== 'APPROVED') {
    return NextResponse.json(
      { error: `Solo se puede generar PDF de documentos APPROVED (estado actual: ${doc.status})` },
      { status: 422 }
    )
  }

  if (doc.finalPdfUrl && !force) {
    return NextResponse.json({
      ok: true, jobId: null, status: 'completed', finalPdfUrl: doc.finalPdfUrl,
      message: 'PDF ya generado. Use force=true con permisos SYSTEM_ADMIN para regenerar.',
    })
  }

  const job = await enqueuePdf(id, user.uid, { ip, userAgent: ua })

  try {
    await log({ userId: user.uid, ip, userAgent: ua }, 'PDF_JOB_CREATED', {
      documentId: id, metadata: { jobId: job.id, force },
    })
  } catch { /* audit failure must not block the 202 response */ }

  return NextResponse.json(
    { ok: true, jobId: job.id, status: 'pending', message: 'Generación de PDF iniciada' },
    { status: 202 }
  )
}
