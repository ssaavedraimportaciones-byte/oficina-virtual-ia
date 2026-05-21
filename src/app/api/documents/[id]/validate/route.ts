import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { buildRuleContext, evaluateRules } from '@/modules/rules-engine'
import type { DocumentStatus } from '@/types/document'

interface Params {
  params: { id: string }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = params

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

    return NextResponse.json({
      ok: true,
      documentId: id,
      validation: result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al validar el documento'
    console.error('[validate]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
