import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getConfig, saveConfig } from '@/lib/store'

const configSchema = z.object({
  agentName: z.string().min(1),
  businessName: z.string().min(1),
  industry: z.string().min(1),
  description: z.string().min(1),
  goals: z.string().min(1),
  tone: z.enum(['cercano', 'formal', 'directo']),
  channels: z.array(z.enum(['whatsapp', 'instagram', 'simulador'])).min(1),
})

export async function GET() {
  const config = await getConfig()
  return NextResponse.json({ config })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = configSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const config = await saveConfig({
    ...parsed.data,
    configuredAt: new Date().toISOString(),
  })

  return NextResponse.json({ config })
}
