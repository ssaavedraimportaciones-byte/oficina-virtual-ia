import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createBusiness, listBusinesses } from '@/lib/store'
import { agentConfigSchema } from '@/lib/validation'

export async function GET() {
  const businesses = await listBusinesses()
  return NextResponse.json({ businesses })
}

const createSchema = z.object({
  templateId: z.string().min(1),
  config: agentConfigSchema,
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const business = await createBusiness(
    { ...parsed.data.config, configuredAt: new Date().toISOString() },
    parsed.data.templateId,
  )

  return NextResponse.json({ business })
}
