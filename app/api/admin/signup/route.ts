import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePlatformAdmin } from '@/lib/authz'
import { setSignupOpen, signupForcedOpenByEnv, signupOpen } from '@/lib/signup'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin
  return NextResponse.json({ open: await signupOpen(), forcedByEnv: signupForcedOpenByEnv() })
}

const schema = z.object({ open: z.boolean() })

/** Abre o cierra el registro público. Solo el dueño de la plataforma. */
export async function PUT(request: NextRequest) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const open = await setSignupOpen(parsed.data.open)
  // Con ALLOW_SIGNUP=true el registro queda abierto aunque acá se apague: hay que avisarlo.
  return NextResponse.json({ open, forcedByEnv: signupForcedOpenByEnv() })
}
