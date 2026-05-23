'use client'

import { useEffect, useState } from 'react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

export default function ConnectionStatus() {
  const { isOnline, justReconnected } = useNetworkStatus()
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    if (justReconnected) {
      setShowReconnected(true)
      const t = setTimeout(() => setShowReconnected(false), 3000)
      return () => clearTimeout(t)
    }
  }, [justReconnected])

  if (isOnline && !showReconnected) return null

  if (!isOnline) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed top-0 left-0 right-0 z-50 bg-red-900 border-b border-red-700 text-red-100 text-xs font-medium px-4 py-2 text-center"
      >
        📵 Sin conexión — los cambios podrían no sincronizarse
      </div>
    )
  }

  if (showReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-50 bg-green-900 border-b border-green-700 text-green-100 text-xs font-medium px-4 py-2 text-center"
      >
        ✅ Conexión recuperada
      </div>
    )
  }

  return null
}
