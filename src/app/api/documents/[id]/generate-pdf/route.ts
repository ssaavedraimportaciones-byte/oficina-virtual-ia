import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, getIp } from '@/app/api/_lib/auth-middleware'
import { generateFinalPdf } from '@/modules/pdf'

interface Params {
  params: { id: string }
}

/**
 * POST /api/documents/[id]/generate-pdf
 * Generates (or regenerates) the final approved PDF.
 * Only callable on APPROVED documents.
 * Each call creates a new versioned file; the old file is preserved.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = requirePermission(req, 'documents:approve')
  if ('error' in auth) return auth.error
  const { user } = auth

  try {
    const result = await generateFinalPdf(params.id, user.uid, getIp(req))
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al generar PDF'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
