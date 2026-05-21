import type { UserRole, Habilitacion } from '@/types/user'
import type { DocumentTipo } from '@/types/document'

export function puedeAprobarNivel(role: UserRole, nivel: 1 | 2 | 3): boolean {
  if (role === 'admin') return true
  if (nivel === 1) return ['supervisor', 'prevencionista', 'jefe_area'].includes(role)
  if (nivel === 2) return ['prevencionista', 'jefe_area'].includes(role)
  if (nivel === 3) return role === 'jefe_area'
  return false
}

export function puedeVerAuditoria(role: UserRole): boolean {
  return role === 'admin' || role === 'auditor'
}

export function puedeCrearDocumento(role: UserRole): boolean {
  return role !== 'auditor'
}

export function puedeGestionarUsuarios(role: UserRole): boolean {
  return role === 'admin'
}

const HABILITACIONES_REQUERIDAS: Partial<Record<DocumentTipo, Habilitacion>> = {
  ALTURA: 'altura',
  ESPACIO_CONFINADO: 'espacio_confinado',
  IZAJE: 'izaje',
  LOTO: 'loto',
}

export function tieneHabilitacionRequerida(
  tipo: DocumentTipo,
  habilitaciones: Habilitacion[]
): boolean {
  const requerida = HABILITACIONES_REQUERIDAS[tipo]
  if (!requerida) return true
  return habilitaciones.includes(requerida)
}
