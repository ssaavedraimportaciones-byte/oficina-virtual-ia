import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { requireAuth } from '@/app/api/_lib/auth-middleware'

// GET /api/documents/[id]/versions
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = requireAuth(req)
  if ('error' in result) return result.error
  const { user } = result

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, companyId: true, createdById: true },
  })

  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  if (user.role === 'WORKER' && doc.createdById !== user.uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const canViewAll = ['SUPERVISOR', 'PREVENTIONIST', 'CONTRACT_ADMIN', 'MANAGER', 'AUDITOR', 'SYSTEM_ADMIN'].includes(user.role)
  if (!canViewAll && doc.createdById !== user.uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const versions = await prisma.documentVersion.findMany({
    where: { documentId: id },
    orderBy: { version: 'asc' },
    select: {
      id: true,
      version: true,
      createdAt: true,
      createdById: true,
      createdBy: { select: { name: true, role: true } },
    },
  })

  return NextResponse.json({
    documentId: id,
    total: versions.length,
    versions: versions.map((v) => ({
      ...v,
      createdAt: v.createdAt.toISOString(),
    })),
  })
}
