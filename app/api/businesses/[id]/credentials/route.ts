import { NextRequest, NextResponse } from 'next/server'
import { getBusiness, updateBusinessCredentials } from '@/lib/store'
import { credentialsSchema } from '@/lib/validation'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const parsed = credentialsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (!(await getBusiness(id))) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const business = await updateBusinessCredentials(id, parsed.data)
  return NextResponse.json({ business })
}
