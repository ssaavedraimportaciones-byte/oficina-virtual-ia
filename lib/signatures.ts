import type { DocumentTipo } from '@/types/document'
import type { UserRole, Habilitacion } from '@/types/user'
import { tieneHabilitacionRequerida } from './roles'

export interface SignatureEligibility {
  permitida: boolean
  motivo?: string
}

export function puedeFiremar(
  tipo: DocumentTipo,
  role: UserRole,
  habilitaciones: Habilitacion[],
  userId: string,
  participantes: string[],
  firmasCompletadas: string[]
): SignatureEligibility {
  if (firmasCompletadas.includes(userId)) {
    return { permitida: false, motivo: 'Ya firmaste este documento' }
  }

  const esParticipante = participantes.includes(userId)
  const tieneRolSuperior = ['supervisor', 'prevencionista', 'jefe_area', 'admin'].includes(role)

  if (!esParticipante && !tieneRolSuperior) {
    return { permitida: false, motivo: 'No eres participante de este documento' }
  }

  if (!tieneHabilitacionRequerida(tipo, habilitaciones)) {
    return { permitida: false, motivo: 'Requieres habilitación específica para este tipo de documento' }
  }

  return { permitida: true }
}
