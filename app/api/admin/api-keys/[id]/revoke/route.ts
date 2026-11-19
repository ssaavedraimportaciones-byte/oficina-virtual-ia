import { NextResponse } from 'next/server'
import { revokeApiKey } from '@/lib/apiKeys'
import { requirePlatformAdmin } from '@/lib/authz'

/** Revoca la clave al instante. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin
  const { id } = await params
  const key = await revokeApiKey(id)
  return key ? NextResponse.json({ key }) : NextResponse.json({ error: 'Clave no encontrada' }, { status: 404 })
}
