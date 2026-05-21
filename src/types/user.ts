export type UserRole =
  | 'WORKER'
  | 'SUPERVISOR'
  | 'PREVENTIONIST'
  | 'CONTRACT_ADMIN'
  | 'MANAGER'
  | 'AUDITOR'
  | 'SYSTEM_ADMIN'

export interface TokenPayload {
  uid: string
  email: string
  name: string
  role: string
  companyId: string
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  companyId: string
  isActive: boolean
}
