'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import Nav from './nav'
import LoadingState from '@/components/ui/LoadingState'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Close mobile nav on route change
  useEffect(() => { setMobileNavOpen(false) }, [pathname])

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileNavOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [isLoading, user, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingState message="Iniciando SafeCheck AI…" size="lg" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="w-56 flex-shrink-0 hidden md:block">
        <Nav />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-gray-950">SC</span>
          </div>
          <span className="font-semibold text-white text-sm">SafeCheck AI</span>
        </div>
        <button
          onClick={() => setMobileNavOpen(true)}
          aria-label="Abrir menú"
          className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/60"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <aside className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-64 shadow-2xl">
            <div className="flex justify-end p-3 bg-gray-900 border-b border-gray-800">
              <button
                onClick={() => setMobileNavOpen(false)}
                aria-label="Cerrar menú"
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="h-full overflow-y-auto">
              <Nav />
            </div>
          </aside>
        </>
      )}

      {/* Main content — add top padding on mobile for the fixed top bar */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">{children}</main>
    </div>
  )
}
