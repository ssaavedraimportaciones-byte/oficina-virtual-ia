export type UserRole =
  | 'trabajador'
  | 'supervisor'
  | 'prevencionista'
  | 'jefe_area'
  | 'admin'
  | 'auditor'

export type Habilitacion = 'altura' | 'espacio_confinado' | 'izaje' | 'loto'

export interface User {
  uid: string
  email: string
  nombre: string
  rut: string
  cargo: string
  empresa: string
  faena: string
  role: UserRole
  habilitaciones: Habilitacion[]
  activo: boolean
  createdAt: string
  updatedAt: string
}

export interface UserPublic {
  uid: string
  nombre: string
  rut: string
  cargo: string
  role: UserRole
  habilitaciones: Habilitacion[]
}
