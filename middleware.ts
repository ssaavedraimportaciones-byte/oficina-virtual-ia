import { NextRequest, NextResponse } from 'next/server'

/**
 * Puerta de entrada de la API. Antes las rutas /api/* estaban abiertas: el
 * candado solo estaba en las páginas, así que cualquiera con curl podía leer,
 * modificar o borrar los datos de todos los negocios.
 *
 * Corre en el runtime Edge, por eso usa Web Crypto en lugar de node:crypto.
 */

/** Rutas que no pueden pedir sesión, porque las llama alguien de afuera. */
const PUBLIC_API = [
  // Meta firma sus webhooks; se validan por firma, no por cookie.
  '/api/webhooks/',
  // El login es justamente cómo se obtiene la sesión.
  '/api/admin/login',
]

async function hmacHex(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD
  const panelPassword = process.env.PANEL_PASSWORD || adminPassword

  const candidates: [string | undefined, string, string][] = [
    [adminPassword, 'agentsapp_admin', 'agentsapp-admin-session'],
    [panelPassword, 'agentsapp_panel', 'agentsapp-panel-session'],
  ]

  for (const [password, cookieName, payload] of candidates) {
    if (!password) continue
    const cookie = request.cookies.get(cookieName)?.value
    if (!cookie) continue
    if (timingSafeEqual(cookie, await hmacHex(password, payload))) return true
  }

  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_API.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // Sin contraseña configurada no hay forma de autenticarse: se cierra todo en
  // vez de dejar la API abierta por una variable de entorno olvidada.
  if (!process.env.ADMIN_PASSWORD && !process.env.PANEL_PASSWORD) {
    return NextResponse.json(
      { error: 'El servidor no tiene ADMIN_PASSWORD configurada. La API está deshabilitada.' },
      { status: 503 },
    )
  }

  if (await hasValidSession(request)) {
    return NextResponse.next()
  }

  return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
}

export const config = {
  matcher: '/api/:path*',
}
