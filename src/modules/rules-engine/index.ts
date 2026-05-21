import type { DocumentTipo, DocumentEstado } from '@/types/document'
import type { UserRole } from '@/types/user'

export interface TransicionResult {
  permitida: boolean
  motivo?: string
}

interface DocSnapshot {
  tipo: DocumentTipo
  firmasIds: string[]
  firmasRequeridas: string[]
  aprobacionesCompletadas: number
  aprobacionesRequeridas: number
}

type Regla = {
  haciaPermitido: DocumentEstado[]
  rolesPermitidos: UserRole[]
  condicion?: (hacia: DocumentEstado, doc: DocSnapshot) => TransicionResult
}

const REGLAS: Partial<Record<DocumentEstado, Regla>> = {
  BORRADOR: {
    haciaPermitido: ['COMPLETADO'],
    rolesPermitidos: ['TRABAJADOR', 'SUPERVISOR', 'PREVENCIONISTA', 'JEFE_AREA', 'ADMIN'],
  },
  COMPLETADO: {
    haciaPermitido: ['FIRMADO'],
    rolesPermitidos: ['TRABAJADOR', 'SUPERVISOR', 'PREVENCIONISTA', 'JEFE_AREA', 'ADMIN'],
    condicion: (_, doc) => {
      const pendientes = doc.firmasRequeridas.filter(uid => !doc.firmasIds.includes(uid))
      return pendientes.length > 0
        ? { permitida: false, motivo: `Faltan ${pendientes.length} firma(s)` }
        : { permitida: true }
    },
  },
  FIRMADO: {
    haciaPermitido: ['PENDIENTE_APROBACION'],
    rolesPermitidos: ['TRABAJADOR', 'SUPERVISOR', 'PREVENCIONISTA', 'JEFE_AREA', 'ADMIN'],
  },
  PENDIENTE_APROBACION: {
    haciaPermitido: ['APROBADO', 'RECHAZADO'],
    rolesPermitidos: ['SUPERVISOR', 'PREVENCIONISTA', 'JEFE_AREA', 'ADMIN'],
    condicion: (hacia, doc) => {
      if (hacia === 'APROBADO' && doc.aprobacionesCompletadas < doc.aprobacionesRequeridas) {
        return { permitida: false, motivo: `Faltan ${doc.aprobacionesRequeridas - doc.aprobacionesCompletadas} aprobación(es)` }
      }
      return { permitida: true }
    },
  },
  RECHAZADO: {
    haciaPermitido: ['BORRADOR'],
    rolesPermitidos: ['TRABAJADOR', 'SUPERVISOR', 'PREVENCIONISTA', 'JEFE_AREA', 'ADMIN'],
  },
  APROBADO: { haciaPermitido: ['TIMBRADO'], rolesPermitidos: ['PREVENCIONISTA', 'ADMIN'] },
  TIMBRADO: { haciaPermitido: ['ARCHIVADO'], rolesPermitidos: ['ADMIN'] },
  ARCHIVADO: { haciaPermitido: [], rolesPermitidos: [] },
}

export function validarTransicion(
  desde: DocumentEstado,
  hacia: DocumentEstado,
  role: UserRole,
  doc: DocSnapshot
): TransicionResult {
  const regla = REGLAS[desde]
  if (!regla) return { permitida: false, motivo: 'Estado no reconocido' }
  if (!regla.haciaPermitido.includes(hacia)) return { permitida: false, motivo: `${desde} → ${hacia} no permitida` }
  if (!regla.rolesPermitidos.includes(role)) return { permitida: false, motivo: `Rol "${role}" sin permiso` }
  return regla.condicion ? regla.condicion(hacia, doc) : { permitida: true }
}
