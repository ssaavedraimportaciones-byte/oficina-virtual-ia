import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/app/api/_lib/auth-middleware'
import { getJobQueue } from '@/modules/jobs'

// GET /api/documents/[id]/scan/status?jobId=<uuid>
// Returns the current state of an async OCR job.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = requireAuth(req)
  if ('error' in result) return result.error

  const { user } = result

  const jobId = req.nextUrl.searchParams.get('jobId')
  if (!jobId) {
    return NextResponse.json({ error: 'Parámetro jobId requerido' }, { status: 400 })
  }

  const job = getJobQueue().get(jobId)
  if (!job) {
    return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 })
  }

  // Workers only see their own jobs; admins/supervisors can see any
  if (user.role === 'WORKER' && job.userId !== user.uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Ensure the job belongs to the document in the URL
  if (job.documentId !== id) {
    return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 })
  }

  return NextResponse.json({
    jobId: job.id,
    documentId: job.documentId,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
    // Only surface a generic error message — never internal details
    error: job.error ?? null,
  })
}
