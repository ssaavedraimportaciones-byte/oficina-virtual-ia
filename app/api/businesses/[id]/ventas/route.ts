import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBusinessAccess } from '@/lib/authz'
import { getSalesSettings, saveSalesSettings } from '@/lib/payments'
import { MAX_CUTOFF_MINUTES, MAX_PREORDER_MINUTES } from '@/lib/orderWindow'

/** Cobros, cocina e inventario del negocio. El token de Mercado Pago nunca se devuelve. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user
  return NextResponse.json({ settings: await getSalesSettings(id) })
}

const schema = z.object({
  paymentsEnabled: z.boolean().optional(),
  transferInfo: z.string().max(1000).optional(),
  holdMinutes: z.number().int().min(5).max(240).optional(),
  mercadoPagoToken: z.string().min(10).max(300).nullable().optional(),
  kitchenEnabled: z.boolean().optional(),
  autoConfirmReceipts: z.boolean().optional(),
  stockAlertsEnabled: z.boolean().optional(),
  stockAlertThreshold: z.number().int().min(0).max(10000).optional(),
  ordersOnlyInHours: z.boolean().optional(),
  preorderMinutes: z.number().int().min(0).max(MAX_PREORDER_MINUTES).optional(),
  orderCutoffMinutes: z.number().int().min(0).max(MAX_CUTOFF_MINUTES).optional(),
  ingredientsEnabled: z.boolean().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Revisa los datos.' }, { status: 400 })

  const result = await saveSalesSettings(id, parsed.data)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ settings: result.settings })
}
