import { NextRequest, NextResponse } from 'next/server'
import { deleteBusiness, getBusiness, updateBusinessConfig } from '@/lib/store'
import { toPublicBusiness } from '@/lib/publicBusiness'
import { agentConfigSchema } from '@/lib/validation'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const business = await getBusiness(id)
  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }
  return NextResponse.json({ business: toPublicBusiness(business) })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const parsed = agentConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await getBusiness(id)
  if (!existing) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const business = await updateBusinessConfig(id, {
    ...parsed.data,
    configuredAt: existing.config.configuredAt,
  })
  return NextResponse.json({ business: toPublicBusiness(business) })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteBusiness(id)
  return NextResponse.json({ ok: true })
}
