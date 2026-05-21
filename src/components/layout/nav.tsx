'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { NAV_ITEMS } from '@/lib/permissions/routes'
import OfflineStatusBar from '@/components/offline/OfflineStatusBar'
import ConflictResolver from '@/components/offline/ConflictResolver'

const ROLE_LABELS: Record<string, string> = {
  WORKER: 'Trabajador',
  SUPERVISOR: 'Supervisor',
  PREVENTIONIST: 'Prevencionista',
  CONTRACT_ADMIN: 'Admin. Contrato',
  MANAGER: 'Jefe de Área',
  AUDITOR: 'Auditor',
  SYSTEM_ADMIN: 'Admin. Sistema',
}

export default function Nav() {
  const { user, can, logout } = useAuth()
  const pathname = usePathname()
  const [showConflicts, setShowConflicts] = useState(false)

  if (!user) return null

  const visibleItems = NAV_ITEMS.filter((item) => can(item.permission))

  return (
    <nav className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-gray-950">SC</span>
          </div>
          <span className="font-semibold text-white text-sm">SafeCheck AI</span>
        </div>
      </div>

      <div className="flex-1 py-3 overflow-y-auto">
        {visibleItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-amber-500/10 text-amber-400 border-r-2 border-amber-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span className="w-4 h-4 flex-shrink-0 opacity-70">·</span>
              {item.label}
            </Link>
          )
        })}
      </div>

      <div className="p-4 border-t border-gray-800 space-y-3">
        <OfflineStatusBar compact onConflictClick={() => setShowConflicts(true)} />
        <div>
          <p className="text-sm font-medium text-white truncate">{user.name}</p>
          <span className="inline-block text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full mt-1">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        </div>
        <button
          onClick={logout}
          className="w-full text-left text-sm text-gray-400 hover:text-red-400 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>

      {showConflicts && (
        <ConflictResolver
          onClose={() => setShowConflicts(false)}
          onResolved={() => setShowConflicts(false)}
        />
      )}
    </nav>
  )
}
