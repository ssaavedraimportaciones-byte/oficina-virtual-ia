import { NextResponse } from 'next/server'
import { canAccessBusiness, getCurrentUser, isPlatformAdmin, type SessionUser } from './auth'

/**
 * Helpers para el principio de las rutas de API. El middleware ya filtró que
 * haya UNA cookie de sesión con firma plausible (rápido, en el edge); acá se
 * valida contra la base que la sesión siga viva y que el usuario tenga
 * permiso sobre el recurso puntual que pide — es la autorización real.
 *
 * Uso: `const user = await requireUser(); if (user instanceof NextResponse) return user`
 */

export async function requireUser(): Promise<SessionUser | NextResponse> {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  return user
}

export async function requirePlatformAdmin(): Promise<SessionUser | NextResponse> {
  const user = await requireUser()
  if (user instanceof NextResponse) return user
  if (!isPlatformAdmin(user)) {
    return NextResponse.json({ error: 'Requiere permisos de administrador' }, { status: 403 })
  }
  return user
}

export async function requireBusinessAccess(
  businessId: string,
): Promise<SessionUser | NextResponse> {
  const user = await requireUser()
  if (user instanceof NextResponse) return user
  if (!canAccessBusiness(user, businessId)) {
    // 404 en vez de 403: no confirma si el negocio existe a alguien que no
    // tiene acceso a él.
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }
  return user
}
