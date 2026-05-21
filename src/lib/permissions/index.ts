import type { UserRole, Habilitacion } from '@/types/user'
import type { DocumentTipo } from '@/types/document'

export const puedeCrearDocumento = (role: UserRole) => role !== 'AUDITOR'
export const puedeGestionarUsuarios = (role: UserRole) => role === 'ADMIN'
export const puedeVerAuditoria = (role: UserRole) => role === 'ADMIN' || role === 'AUDITOR'
export const puedeTimbrar = (role: UserRole) => role === 'ADMIN' || role === 'PREVENCIONISTA'

export function puedeAprobarNivel(role: UserRole, nivel: 1 | 2 | 3): boolean {
  if (role === 'ADMIN') return true
  if (nivel === 1) return ['SUPERVISOR', 'PREVENCIONISTA', 'JEFE_AREA'].includes(role)
  if (nivel === 2) return ['PREVENCIONISTA', 'JEFE_AREA'].includes(role)
  if (nivel === 3) return role === 'JEFE_AREA'
  return false
}

const HABILITACIONES_REQUERIDAS: Partial<Record<DocumentTipo, Habilitacion>> = {
  ALTURA: 'ALTURA',
  ESPACIO_CONFINADO: 'ESPACIO_CONFINADO',
  IZAJE: 'IZAJE',
  LOTO: 'LOTO',
}

export function tieneHabilitacion(tipo: DocumentTipo, habilitaciones: Habilitacion[]): boolean {
  const req = HABILITACIONES_REQUERIDAS[tipo]
  return !req || habilitaciones.includes(req)
}
