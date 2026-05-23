import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { QR_SECRET } from '@/lib/env'

// GET /api/storage/signed-url?token=<jwt>
// Validates the signed JWT and redirects to the underlying Vercel Blob URL.
// The JWT contains { path } — the sanitized storage path within the Blob store.
// Short-lived (default 15 min). Requires the caller to be authenticated
// (middleware enforces this — /api/storage is not in PUBLIC_PREFIXES).
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  try {
    const secret = new TextEncoder().encode(QR_SECRET)
    const { payload } = await jwtVerify(token, secret)
    const path = payload['path']
    if (typeof path !== 'string' || !path) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 400 })
    }

    // Construct Vercel Blob URL (public CDN — access enforced by our signed token layer)
    const blobBase = process.env.BLOB_BASE_URL ?? `https://blob.vercel-storage.com`
    const blobUrl = `${blobBase}/${path}`

    return NextResponse.redirect(blobUrl, { status: 302 })
  } catch {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
  }
}
