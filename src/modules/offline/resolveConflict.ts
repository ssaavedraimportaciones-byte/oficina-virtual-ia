import { conflictsDb, draftsDb, queueDb } from './db'
import type { ConflictInfo } from './types'

/**
 * Resolves a conflict between a local draft and the server version.
 *
 * 'server_wins' — always used when server is APPROVED/CLOSED/ARCHIVED.
 *   Marks the local draft as 'synced' with server data. No upload happens.
 *
 * 'local_wins' — only valid when server is still in DRAFT.
 *   Re-queues the local draft for upload (overwrite).
 */
export async function resolveConflict(
  conflictId: string,
  strategy: 'server_wins' | 'local_wins'
): Promise<void> {
  const conflict = await conflictsDb.get(conflictId)
  if (!conflict) throw new Error('Conflicto no encontrado')
  if (conflict.resolvedAt) throw new Error('Conflicto ya fue resuelto')

  const IMMUTABLE = new Set(['APPROVED', 'CLOSED', 'ARCHIVED'])
  if (strategy === 'local_wins' && IMMUTABLE.has(conflict.serverVersion.status)) {
    throw new Error(
      `No se puede aplicar "local gana" — el documento ya está ${conflict.serverVersion.status} en el servidor`
    )
  }

  const now = new Date().toISOString()

  if (strategy === 'server_wins') {
    // Mark local draft as synced — server version is authoritative
    const draft = await draftsDb.get(conflict.draftId)
    if (draft) {
      await draftsDb.put({
        ...draft,
        syncStatus: 'synced',
        serverId: conflict.serverId,
        serverStatus: conflict.serverVersion.status,
        syncedAt: now,
        updatedAt: now,
      })
    }

    // Cancel any queued actions for this draft
    const allActions = await queueDb.getAll()
    await Promise.all(
      allActions
        .filter((a) => a.draftId === conflict.draftId && a.status === 'pending')
        .map((a) => queueDb.put({ ...a, status: 'done', lastError: 'Cancelado — servidor gana' }))
    )
  } else {
    // local_wins — re-queue CREATE_DOCUMENT for forced upload
    const draft = await draftsDb.get(conflict.draftId)
    if (draft) {
      await draftsDb.put({ ...draft, syncStatus: 'pending', updatedAt: now })
    }

    // Remove failed actions so they get retried
    const allActions = await queueDb.getAll()
    await Promise.all(
      allActions
        .filter((a) => a.draftId === conflict.draftId && a.status === 'failed')
        .map((a) => queueDb.put({ ...a, status: 'pending', retries: 0, lastError: undefined }))
    )
  }

  // Mark conflict resolved
  await conflictsDb.put({
    ...conflict,
    resolvedAt: now,
    resolution: strategy === 'server_wins' ? 'server_wins' : 'local_wins',
  })
}
