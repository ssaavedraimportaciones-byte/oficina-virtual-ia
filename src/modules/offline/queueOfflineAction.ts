import { queueDb, isSupported } from './db'
import type { OfflineAction, OfflineActionType } from './types'

function localId(): string {
  return `action_${crypto.randomUUID()}`
}

/**
 * Adds an action to the offline queue.
 * Actions are processed in creation order when syncPendingActions() runs.
 */
export async function queueOfflineAction(params: {
  draftId: string
  type: OfflineActionType
  payload: Record<string, unknown>
}): Promise<OfflineAction> {
  if (!isSupported()) throw new Error('IndexedDB no disponible')

  const action: OfflineAction = {
    id: localId(),
    draftId: params.draftId,
    type: params.type,
    payload: params.payload,
    status: 'pending',
    retries: 0,
    createdAt: new Date().toISOString(),
  }

  await queueDb.put(action)

  // Hint the browser to schedule a background sync (if SW supports it)
  if (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    navigator.serviceWorker.controller
  ) {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg && 'sync' in reg) {
        await (reg as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } })
          .sync.register('safecheck-sync')
      }
    } catch {
      // Background Sync API not available — sync will be triggered manually
    }
  }

  return action
}

/**
 * Returns all pending actions sorted by creation time (oldest first).
 * CREATE_DOCUMENT actions are always returned before signatures/photos
 * for the same draft to preserve dependency order.
 */
export async function getPendingActions(): Promise<OfflineAction[]> {
  if (!isSupported()) return []
  const all = await queueDb.getAll()
  return all
    .filter((a) => a.status === 'pending' || a.status === 'failed')
    .sort((a, b) => {
      // CREATE_DOCUMENT before everything else within same draft
      if (a.draftId === b.draftId) {
        if (a.type === 'CREATE_DOCUMENT') return -1
        if (b.type === 'CREATE_DOCUMENT') return 1
      }
      return a.createdAt.localeCompare(b.createdAt)
    })
}

export async function clearDoneActions(): Promise<void> {
  if (!isSupported()) return
  const all = await queueDb.getAll()
  await Promise.all(all.filter((a) => a.status === 'done').map((a) => queueDb.delete(a.id)))
}
