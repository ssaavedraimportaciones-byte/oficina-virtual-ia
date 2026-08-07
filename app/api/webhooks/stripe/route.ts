import { NextRequest, NextResponse } from 'next/server'
import { handleStripeWebhook } from '@/lib/billing'

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const result = await handleStripeWebhook(rawBody, request.headers.get('stripe-signature'))

  if (!result.ok) {
    console.error('[webhook stripe] rechazado:', result.reason)
    return NextResponse.json({ error: result.reason }, { status: result.status })
  }

  return NextResponse.json({ ok: true })
}
