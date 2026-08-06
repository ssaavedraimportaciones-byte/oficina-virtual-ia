import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

export const ADMIN_COOKIE = 'agentsapp_admin'

function getPassword(): string | null {
  return process.env.ADMIN_PASSWORD || null
}

/**
 * Valor de sesión derivado de la contraseña: sin la contraseña correcta no se
 * puede fabricar, y cambiarla invalida las sesiones existentes.
 */
function sessionValue(password: string): string {
  return createHmac('sha256', password).update('agentsapp-admin-session').digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function checkPassword(candidate: string): string | null {
  const password = getPassword()
  if (!password) return null
  if (!safeEqual(candidate, password)) return null
  return sessionValue(password)
}

/**
 * Estado del acceso al panel de administración. `configured: false` significa
 * que falta ADMIN_PASSWORD: en ese caso el panel se bloquea en vez de quedar
 * abierto, para no exponer todos los negocios por olvidar una variable.
 */
export async function getAdminAccess(): Promise<{ configured: boolean; authorized: boolean }> {
  const password = getPassword()
  if (!password) return { configured: false, authorized: false }

  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!cookie) return { configured: true, authorized: false }

  return { configured: true, authorized: safeEqual(cookie, sessionValue(password)) }
}
