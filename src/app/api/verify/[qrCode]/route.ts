import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { generateQrCode } from '@/modules/qr'

// GET /api/verify/[qrCode]
// Public endpoint — no authentication required.
// Verifies a document's QR code and returns its certification status.
export async function GET(
  _req: NextRequest,
  { params }: { params: { qrCode: string } }
) {
  const { qrCode } = params

  if (!qrCode || qrCode.length !== 64 || !/^[0-9a-f]+$/.test(qrCode)) {
    return NextResponse.json({ valid: false, error: 'Código QR inválido' }, { status: 400 })
  }

  const doc = await prisma.document.findUnique({
    where: { qrCode },
    select: {
      id: true,
      folio: true,
      type: true,
      status: true,
      taskName: true,
      workArea: true,
      qrCode: true,
      createdAt: true,
      approvals: {
        where: { status: 'APPROVED' },
        select: {
          role: true,
          approvedAt: true,
          approver: { select: { name: true } },
        },
        orderBy: { approvedAt: 'asc' },
      },
      company: { select: { name: true } },
    },
  })

  if (!doc) {
    return NextResponse.json({ valid: false, error: 'Documento no encontrado o código QR no válido' }, { status: 404 })
  }

  if (doc.status !== 'APPROVED' && doc.status !== 'CLOSED') {
    return NextResponse.json(
      {
        valid: false,
        folio: doc.folio,
        status: doc.status,
        error: 'Este documento no está aprobado',
      },
      { status: 200 }
    )
  }

  // Re-derive the expected QR hash from the document's immutable fields to
  // confirm the stored qrCode was generated from the correct inputs.
  // The approval date is the earliest APPROVED approval timestamp.
  const firstApproval = doc.approvals[0]
  if (!firstApproval?.approvedAt) {
    return NextResponse.json({ valid: false, error: 'Sin registro de aprobación' }, { status: 200 })
  }

  const expectedQrCode = generateQrCode({
    documentId: doc.id,
    folio: doc.folio,
    approvedAt: firstApproval.approvedAt.toISOString(),
  })

  if (expectedQrCode !== qrCode) {
    return NextResponse.json(
      { valid: false, error: 'El código QR no coincide con los datos del documento' },
      { status: 200 }
    )
  }

  return NextResponse.json({
    valid: true,
    folio: doc.folio,
    type: doc.type,
    status: doc.status,
    taskName: doc.taskName,
    workArea: doc.workArea,
    company: doc.company.name,
    createdAt: doc.createdAt.toISOString(),
    approvals: doc.approvals.map((a) => ({
      role: a.role,
      approverName: a.approver.name,
      approvedAt: a.approvedAt?.toISOString(),
    })),
  })
}
