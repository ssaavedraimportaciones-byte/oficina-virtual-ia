import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUser, listUsers } from '@/lib/auth'
import { requirePlatformAdmin } from '@/lib/authz'

export async function GET() {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin

  return NextResponse.json({ users: await listUsers() })
}

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  role: z.enum(['PLATFORM_ADMIN', 'USER']).default('USER'),
})

export async function POST(request: NextRequest) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await createUser(parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 409 })
  }

  return NextResponse.json({ id: result.id })
}
