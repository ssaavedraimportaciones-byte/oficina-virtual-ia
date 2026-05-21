'use client'

import { useEffect, useRef, useState } from 'react'

interface NetworkStatus {
  isOnline: boolean
  /** True during the render cycle immediately after coming back online */
  justReconnected: boolean
}

/**
 * Tracks browser online/offline events.
 * `justReconnected` is true for one render cycle after reconnecting —
 * use it to trigger a sync without debounce delay.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [justReconnected, setJustReconnected] = useState(false)
  const prevOnlineRef = useRef(isOnline)

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      if (!prevOnlineRef.current) {
        setJustReconnected(true)
        // Reset flag after one cycle
        setTimeout(() => setJustReconnected(false), 100)
      }
      prevOnlineRef.current = true
    }

    function handleOffline() {
      setIsOnline(false)
      prevOnlineRef.current = false
      setJustReconnected(false)
    }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, justReconnected }
}
