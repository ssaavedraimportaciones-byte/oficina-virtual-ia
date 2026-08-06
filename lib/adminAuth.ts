import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

export type Scope = 'admin' | 'panel'

const COOKIE: Record<Scope, string> = {
  admin: 'agentsapp_admin',
  panel: 'agentsapp_panel',
}

export function cookieName(scope: Scope): string {
  return COOKIE[scope]
}

function getPassword(scope: Scope): string | null {
  if (scope === 'admin') return process.env.ADMIN_PASSWORD || null
  // El panel acepta también la contraseña de admin, para que el dueño entre a
  // todo con una sola credencial.
  return process.env.PANEL_PASSWORD || process.env.ADMIN_PASSWORD || null
}

/**
 * Valor de sesión derivado de la contraseña: sin la contraseña correcta no se
 * puede fabricar, y cambiarla invalida las sesiones existentes.
 */
function sessionValue(scope: Scope, password: string): string {
  return createHmac('sha256', password).update(`agentsapp-${scope}-session`).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function checkPassword(scope: Scope, candidate: string): string | null {
  const password = getPassword(scope)
  if (!password) return null
  if (!safeEqual(candidate, password)) return null
  return sessionValue(scope, password)
}

/**
 * Estado del acceso. `configured: false` significa que falta la contraseña en
 * las variables de entorno: en ese caso se bloquea el acceso en vez de dejarlo
 * abierto, para no exponer los datos por una variable olvidada.
 */
export async function getAccess(scope: Scope): Promise<{
  configured: boolean
  authorized: boolean
}> {
  const password = getPassword(scope)
  if (!password) return { configured: false, authorized: false }

  const cookie = (await cookies()).get(COOKIE[scope])?.value
  if (!cookie) return { configured: true, authorized: false }

  return { configured: true, authorized: safeEqual(cookie, sessionValue(scope, password)) }
}
