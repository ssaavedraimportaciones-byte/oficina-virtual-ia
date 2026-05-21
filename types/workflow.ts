import type { DocumentEstado } from './document'
import type { UserRole } from './user'

export interface TransicionPermitida {
  desde: DocumentEstado
  hacia: DocumentEstado
  requiereRol: UserRole[]
}
