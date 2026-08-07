import { NextRequest, NextResponse } from 'next/server'

/**
 * Primer filtro de la API, en el runtime Edge. Las sesiones ahora viven en
 * Postgres (para poder revocarlas, saber a qué negocios pertenece cada
 * usuario, etc.) y Edge no puede abrir una conexión TCP a la base — por eso
 * esto SOLO verifica que exista la cookie de sesión, no que sea válida.
 *
 * La autorización real (¿la sesión sigue viva? ¿este usuario puede ver este
 * negocio puntual?) pasa en runtime Node, adentro de cada ruta y cada página,
 * vía lib/authz.ts. Este middleware es un filtro barato para cortar tráfico
 * obviamente no autenticado antes de que llegue a tocar la base — no la
 * frontera de seguridad.
 */

const SESSION_COOKIE = 'agentsapp_session'

/**
 * Rutas que no piden sesión: las llama alguien de afuera (Meta) o son el
 * login, o son flujos que por definición ocurren SIN sesión activa
 * (recuperar contraseña, verificar email). change-password y
 * resend-verification quedan afuera de esta lista a propósito: requieren
 * una sesión existente.
 */
const PUBLIC_API = [
  '/api/webhooks/',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_API.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
