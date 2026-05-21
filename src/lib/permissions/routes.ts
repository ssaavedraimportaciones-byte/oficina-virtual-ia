import type { UserRole } from '@/types/user'
import type { Permission } from './index'

export const ROLE_DEFAULT_ROUTE: Record<UserRole, string> = {
  WORKER: '/documents',
  SUPERVISOR: '/dashboard',
  PREVENTIONIST: '/dashboard',
  CONTRACT_ADMIN: '/dashboard',
  MANAGER: '/dashboard',
  AUDITOR: '/audit',
  SYSTEM_ADMIN: '/dashboard',
}

export interface NavItem {
  label: string
  href: string
  permission: Permission
  icon?: string
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', permission: 'dashboard:view', icon: 'layout-dashboard' },
  { label: 'Documentos', href: '/documents', permission: 'documents:view_own', icon: 'file-text' },
  { label: 'Aprobaciones', href: '/approvals', permission: 'approvals:view', icon: 'check-circle' },
  { label: 'Trabajadores', href: '/workers', permission: 'workers:view', icon: 'hard-hat' },
  { label: 'Empresas', href: '/companies', permission: 'companies:view', icon: 'building-2' },
  { label: 'Usuarios', href: '/users', permission: 'users:view', icon: 'users' },
  { label: 'Auditoría', href: '/audit', permission: 'audit:view', icon: 'shield-check' },
  { label: 'Configuración', href: '/settings', permission: 'settings:view', icon: 'settings' },
]
