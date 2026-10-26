import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlatformAdmin } from '@/lib/authz'
import { createIntake, listIntakes } from '@/lib/intakeStore'

export async function GET() {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin
  return NextResponse.json({ intakes: await listIntakes() })
}

/** Campo largo y opcional: lo que el cliente dicta por teléfono, tal cual. */
const text = z.string().trim().max(2000).default('')
const short = z.string().trim().max(200).default('')

const schema = z.object({
  contactName: z.string().trim().min(1, 'Falta el nombre del contacto').max(200),
  contactEmail: z.string().trim().email('El mail del contacto no es válido').max(200),
  contactPhone: short,
  businessName: z.string().trim().min(1, 'Falta el nombre del negocio').max(200),
  industry: short,
  legalName: short,
  rut: short,
  address: short,
  whatsappNumber: short,
  whatsappClean: z.boolean().default(false),
  hours: text,
  payments: short,
  catalog: text,
  escalation: text,
  notes: text,
})

export async function POST(request: NextRequest) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    )
  }
  return NextResponse.json({ intake: await createIntake(parsed.data) })
}
