import { NextResponse } from 'next/server'
import { requireBusinessAccess } from '@/lib/authz'
import { getStockAlerts } from '@/lib/stockAlerts'

/** Alertas de inventario del local, para el aviso que se refresca solo en el panel. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user
  return NextResponse.json(await getStockAlerts(id), { headers: { 'Cache-Control': 'no-store' } })
}
