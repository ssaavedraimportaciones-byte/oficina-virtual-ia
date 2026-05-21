export type UserRole = 'TRABAJADOR' | 'SUPERVISOR' | 'PREVENCIONISTA' | 'JEFE_AREA' | 'ADMIN' | 'AUDITOR'
export type Habilitacion = 'ALTURA' | 'ESPACIO_CONFINADO' | 'IZAJE' | 'LOTO'

export interface UserPublic {
  id: string
  nombre: string
  rut: string
  cargo: string
  role: UserRole
  habilitaciones: Habilitacion[]
  faenaId: string | null
  companyId: string | null
}

export interface TokenPayload {
  uid: string
  email: string
  role: string
  faenaId: string
}
