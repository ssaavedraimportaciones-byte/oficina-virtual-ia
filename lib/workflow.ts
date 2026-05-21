import type { DocumentEstado, DocumentTipo } from '@/types/document'
import type { UserRole } from '@/types/user'
import { DOCUMENT_TYPES } from './document-types'

export interface TransicionResult {
  permitida: boolean
  motivo?: string
}

interface DocumentoEstadoSnapshot {
  tipo: DocumentTipo
  firmasCompletadas: string[]
  firmasRequeridas: string[]
  aprobacionesCompletadas: number
  aprobacionesRequeridas: number
}

export function validarTransicion(
  estadoActual: DocumentEstado,
  estadoDeseado: DocumentEstado,
  role: UserRole,
  documento: DocumentoEstadoSnapshot
): TransicionResult {
  type Regla = {
    haciaPermitido: DocumentEstado[]
    rolesPermitidos: UserRole[]
    condicion?: () => TransicionResult
  }

  const reglas: Partial<Record<DocumentEstado, Regla>> = {
    borrador: {
      haciaPermitido: ['completado'],
      rolesPermitidos: ['trabajador', 'supervisor', 'prevencionista', 'jefe_area', 'admin'],
    },
    completado: {
      haciaPermitido: ['firmado'],
      rolesPermitidos: ['trabajador', 'supervisor', 'prevencionista', 'jefe_area', 'admin'],
      condicion: () => {
        const pendientes = documento.firmasRequeridas.filter(
          uid => !documento.firmasCompletadas.includes(uid)
        )
        if (pendientes.length > 0) {
          return { permitida: false, motivo: `Faltan ${pendientes.length} firma(s) requerida(s)` }
        }
        return { permitida: true }
      },
    },
    firmado: {
      haciaPermitido: ['pendiente_aprobacion'],
      rolesPermitidos: ['trabajador', 'supervisor', 'prevencionista', 'jefe_area', 'admin'],
    },
    pendiente_aprobacion: {
      haciaPermitido: ['aprobado', 'rechazado'],
      rolesPermitidos: ['supervisor', 'prevencionista', 'jefe_area', 'admin'],
      condicion: () => {
        if (
          estadoDeseado === 'aprobado' &&
          documento.aprobacionesCompletadas < documento.aprobacionesRequeridas
        ) {
          return {
            permitida: false,
            motivo: `Faltan ${documento.aprobacionesRequeridas - documento.aprobacionesCompletadas} aprobación(es)`,
          }
        }
        return { permitida: true }
      },
    },
    rechazado: {
      haciaPermitido: ['borrador'],
      rolesPermitidos: ['trabajador', 'supervisor', 'prevencionista', 'jefe_area', 'admin'],
    },
    aprobado: {
      haciaPermitido: ['timbrado'],
      rolesPermitidos: ['prevencionista', 'admin'],
    },
    timbrado: {
      haciaPermitido: ['archivado'],
      rolesPermitidos: ['admin'],
    },
    archivado: {
      haciaPermitido: [],
      rolesPermitidos: [],
    },
  }

  const regla = reglas[estadoActual]
  if (!regla) return { permitida: false, motivo: 'Estado actual no reconocido' }
  if (!regla.haciaPermitido.includes(estadoDeseado)) {
    return { permitida: false, motivo: `Transición ${estadoActual} → ${estadoDeseado} no permitida` }
  }
  if (!regla.rolesPermitidos.includes(role)) {
    return { permitida: false, motivo: `El rol "${role}" no puede realizar esta transición` }
  }
  if (regla.condicion) return regla.condicion()
  return { permitida: true }
}

export function aprobacionesRequeridasParaTipo(tipo: DocumentTipo): number {
  return DOCUMENT_TYPES[tipo].aprobacionesRequeridas
}
