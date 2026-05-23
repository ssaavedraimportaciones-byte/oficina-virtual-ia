import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { requireAuth } from '@/app/api/_lib/auth-middleware'

// GET /api/documents/[id]/versions/[version]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  const { id, version: versionParam } = await params
  const result = requireAuth(req)
  if ('error' in result) return result.error
  const { user } = result

  const versionNumber = parseInt(versionParam, 10)
  if (isNaN(versionNumber) || versionNumber < 1) {
    return NextResponse.json({ error: 'Versión inválida' }, { status: 400 })
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, createdById: true },
  })

  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  if (user.role === 'WORKER' && doc.createdById !== user.uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const record = await prisma.documentVersion.findUnique({
    where: { documentId_version: { documentId: id, version: versionNumber } },
    select: {
      id: true,
      documentId: true,
      version: true,
      snapshot: true,
      createdAt: true,
      createdById: true,
      createdBy: { select: { name: true, role: true } },
    },
  })

  if (!record) {
    return NextResponse.json({ error: 'Versión no encontrada' }, { status: 404 })
  }

  return NextResponse.json({
    ...record,
    createdAt: record.createdAt.toISOString(),
  })
}
