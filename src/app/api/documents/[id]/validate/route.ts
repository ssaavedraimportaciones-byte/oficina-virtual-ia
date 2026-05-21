import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { buildRuleContext, evaluateRules } from '@/modules/rules-engine'
import { log } from '@/modules/audit'
import { requireAuth, getIp } from '@/app/api/_lib/auth-middleware'
import type { DocumentStatus } from '@/types/document'

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
      include: {
        fields: true,
        signatures: { include: { user: { select: { name: true, role: true } } } },
      },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    // Build field map from DocumentField records
    const fields: Record<string, string | null> = {}
    for (const f of doc.fields) {
      fields[f.fieldName] = f.fieldValue
    }

    // Build signature identifiers as "name (role)" for rule matching
    const signatures = doc.signatures.map(
      (s) => `${s.user.name} (${s.user.role})`
    )

    const ctx = buildRuleContext({
      taskName: doc.taskName,
      workArea: doc.workArea,
      documentType: doc.type,
      fields,
      signatures,
    })

    const result = evaluateRules(ctx)

    // Persist validation result — rules engine status overrides AI suggestion
    const newStatus: DocumentStatus = result.statusRecommendation
    await prisma.document.update({
      where: { id },
      data: {
        validationResult: result as unknown as Record<string, unknown>,
        // Only move forward if status allows it (don't downgrade APPROVED/CLOSED)
        status: ['DRAFT', 'SCANNED', 'AI_REVIEW', 'OBSERVED', 'PENDING_SIGNATURE'].includes(doc.status)
          ? newStatus
          : doc.status,
      },
    })

    await log(
      { userId: user.uid, ip, userAgent: ua },
      'RULES_VALIDATED',
      {
        documentId: id,
        metadata: {
          passed: result.passed,
          statusRecommendation: result.statusRecommendation,
          blockingIssues: result.blockingIssues,
          warnings: result.warnings,
          rulesEvaluated: result.ruleResults?.length ?? 0,
        },
      }
    )

    return NextResponse.json({ ok: true, documentId: id, validation: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al validar el documento'
    console.error('[validate]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
