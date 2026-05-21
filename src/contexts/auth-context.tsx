'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { AuthUser } from '@/types/user'
import { canAccess, type Permission } from '@/lib/permissions'

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  can: (permission: Permission) => boolean
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user as AuthUser)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const can = useCallback(
    (permission: Permission) => (user ? canAccess(user.role, permission) : false),
    [user]
  )

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await fetch('/api/auth?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Error al iniciar sesión')
    setUser(data.user as AuthUser)
    return data.user as AuthUser
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth?action=logout', { method: 'POST' })
    setUser(null)
    window.location.href = '/login'
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, can, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
