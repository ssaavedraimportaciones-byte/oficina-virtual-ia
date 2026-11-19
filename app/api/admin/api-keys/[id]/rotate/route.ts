import { NextResponse } from 'next/server'
import { rotateApiKey, ROTATION_GRACE_HOURS } from '@/lib/apiKeys'
import { requirePlatformAdmin } from '@/lib/authz'

/** Emite una clave nueva y deja la anterior vigente solo ROTATION_GRACE_HOURS más (para cambiarla sin corte). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin
  const { id } = await params
  const rotated = await rotateApiKey(id, admin.id)
  if (!rotated) return NextResponse.json({ error: 'Clave no encontrada o ya revocada' }, { status: 404 })
  return NextResponse.json(
    { key: rotated.info, secret: rotated.key, previous: rotated.previous, graceHours: ROTATION_GRACE_HOURS },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  )
}
