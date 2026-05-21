'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNetworkStatus } from './useNetworkStatus'
import { isSupported } from '@/modules/offline/db'
import { syncPendingActions } from '@/modules/offline/syncPendingActions'
import { getPendingActions } from '@/modules/offline/queueOfflineAction'
import { getUnresolvedConflicts } from '@/modules/offline/detectConflict'
import type { NetworkStatus, SyncResult } from '@/modules/offline'

interface OfflineSyncState {
  /** Composite status for display */
  status: NetworkStatus
  pendingCount: number
  conflictCount: number
  lastSync: Date | null
  lastResult: SyncResult | null
  triggerSync: () => Promise<void>
}

/**
 * Global offline sync hook. Mount once (in AppShell or root layout).
 * Automatically syncs when the browser comes back online.
 * Exposes status for the status bar and manual trigger.
 */
export function useOfflineSync(): OfflineSyncState {
  const { isOnline, justReconnected } = useNetworkStatus()
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [conflictCount, setConflictCount] = useState(0)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)
  const syncingRef = useRef(false)

  const refreshCounts = useCallback(async () => {
    if (!isSupported()) return
    const [pending, conflicts] = await Promise.all([
      getPendingActions(),
      getUnresolvedConflicts(),
    ])
    setPendingCount(pending.length)
    setConflictCount(conflicts.length)
  }, [])

  const triggerSync = useCallback(async () => {
    if (!isOnline || syncingRef.current || !isSupported()) return
    syncingRef.current = true
    setSyncing(true)
    try {
      const result = await syncPendingActions()
      setLastResult(result)
      setLastSync(new Date())
      await refreshCounts()
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [isOnline, refreshCounts])

  // Refresh counts on mount and periodically
  useEffect(() => {
    refreshCounts()
    const t = setInterval(refreshCounts, 30_000)
    return () => clearInterval(t)
  }, [refreshCounts])

  // Auto-sync when reconnecting
  useEffect(() => {
    if (justReconnected && pendingCount > 0) {
      triggerSync()
    }
  }, [justReconnected, pendingCount, triggerSync])

  // Compute composite status
  let status: NetworkStatus
  if (conflictCount > 0) {
    status = 'conflict'
  } else if (!isOnline) {
    status = 'offline'
  } else if (syncing) {
    status = 'syncing'
  } else if (lastSync !== null && pendingCount === 0) {
    status = 'synced'
  } else {
    status = 'online'
  }

  return { status, pendingCount, conflictCount, lastSync, lastResult, triggerSync }
}
