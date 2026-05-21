import { draftsDb, queueDb, photosDb } from './db'
import { detectConflict } from './detectConflict'
import { getPendingActions } from './queueOfflineAction'
import type { OfflineAction, SyncResult } from './types'

const MAX_RETRIES = 3

/**
 * Processes all queued offline actions in order.
 * - Creates documents first, then attaches signatures and photos.
 * - Detects conflicts before uploading (server wins if APPROVED/CLOSED).
 * - Records serverId on the draft after successful creation.
 * - Never throws — all errors are captured in the result.
 */
export async function syncPendingActions(): Promise<SyncResult> {
  const result: SyncResult = { attempted: 0, succeeded: 0, failed: 0, conflicts: 0, errors: [] }

  const actions = await getPendingActions()
  if (actions.length === 0) return result

  // Map of draftId → serverId discovered during this sync pass
  const draftServerIds = new Map<string, string>()

  // Pre-populate from already-synced drafts
  const allDrafts = await draftsDb.getAll()
  for (const d of allDrafts) {
    if (d.serverId) draftServerIds.set(d.id, d.serverId)
  }

  for (const action of actions) {
    result.attempted++

    try {
      const success = await processAction(action, draftServerIds)
      if (success) {
        result.succeeded++
        await queueDb.put({ ...action, status: 'done' })
      } else {
        result.failed++
        await markFailed(action, 'No se pudo completar la acción')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)

      if (errorMsg.includes('CONFLICT:')) {
        result.conflicts++
        await queueDb.put({ ...action, status: 'failed', lastError: errorMsg })
      } else {
        result.failed++
        result.errors.push({ actionId: action.id, error: errorMsg })
        await markFailed(action, errorMsg)
      }
    }
  }

  return result
}

// ── Action processors ─────────────────────────────────────────────────────────

async function processAction(
  action: OfflineAction,
  serverIdMap: Map<string, string>
): Promise<boolean> {
  switch (action.type) {
    case 'CREATE_DOCUMENT': return createDocument(action, serverIdMap)
    case 'ADD_SIGNATURE':   return addSignature(action, serverIdMap)
    case 'SAVE_PHOTO':      return savePhoto(action, serverIdMap)
    case 'VALIDATE_DOCUMENT': return validateDocument(action, serverIdMap)
    case 'START_APPROVAL_FLOW': return startApprovalFlow(action, serverIdMap)
    default:               return false
  }
}

async function createDocument(
  action: OfflineAction,
  serverIdMap: Map<string, string>
): Promise<boolean> {
  const draft = await draftsDb.get(action.draftId)
  if (!draft) return true // draft deleted — skip

  // Deduplication: already uploaded
  if (draft.serverId) {
    serverIdMap.set(draft.id, draft.serverId)
    return true
  }

  // Conflict check (only if we have a serverId from a previous partial sync)
  const existingServerId = serverIdMap.get(draft.id)
  if (existingServerId) {
    const conflict = await detectConflict(draft, existingServerId)
    if (conflict) {
      await draftsDb.put({ ...draft, syncStatus: 'conflict', updatedAt: new Date().toISOString() })
      throw new Error(`CONFLICT:${conflict.conflictType}`)
    }
  }

  await draftsDb.put({ ...draft, syncStatus: 'syncing', updatedAt: new Date().toISOString() })

  const payload = action.payload as {
    type: string; taskName: string; workArea: string; supervisorId?: string
  }

  const res = await fetch('/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: payload.type,
      taskName: payload.taskName,
      workArea: payload.workArea,
      supervisorId: payload.supervisorId ?? '',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Error ${res.status}: ${text.slice(0, 200)}`)
  }

  const { document } = await res.json()
  serverIdMap.set(draft.id, document.id)

  await draftsDb.put({
    ...draft,
    serverId: document.id,
    syncStatus: 'synced',
    serverStatus: document.status,
    syncedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  return true
}

async function addSignature(
  action: OfflineAction,
  serverIdMap: Map<string, string>
): Promise<boolean> {
  const serverId = serverIdMap.get(action.draftId)
  if (!serverId) return false // CREATE_DOCUMENT not yet processed

  const payload = action.payload as {
    photoId?: string; method: string; signerName: string
  }

  // Load signature image from photos store
  let imageDataUrl: string | undefined
  if (payload.photoId) {
    const photo = await photosDb.get(payload.photoId)
    imageDataUrl = photo?.dataUrl
  }

  const res = await fetch(`/api/documents/${serverId}/signatures`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'CANVAS',
      imageData: imageDataUrl ?? null,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Firma error ${res.status}: ${text.slice(0, 200)}`)
  }

  return true
}

async function savePhoto(
  action: OfflineAction,
  serverIdMap: Map<string, string>
): Promise<boolean> {
  const serverId = serverIdMap.get(action.draftId)
  if (!serverId) return false

  const payload = action.payload as { photoId: string }
  const photo = await photosDb.get(payload.photoId)
  if (!photo) return true // already deleted — skip

  // Convert data URL to blob and upload
  const blob = dataUrlToBlob(photo.dataUrl, photo.mimeType)
  const form = new FormData()
  form.append('file', blob, `evidence_${photo.id}.jpg`)
  form.append('documentId', serverId)
  if (photo.caption && !photo.caption.startsWith('__signature__')) {
    form.append('caption', photo.caption)
  }

  const res = await fetch('/api/documents/evidence', {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Foto error ${res.status}: ${text.slice(0, 200)}`)
  }

  await photosDb.put({ ...photo, syncStatus: 'synced', serverUrl: (await res.json()).url })
  return true
}

async function validateDocument(
  action: OfflineAction,
  serverIdMap: Map<string, string>
): Promise<boolean> {
  const serverId = serverIdMap.get(action.draftId)
  if (!serverId) return false

  const res = await fetch(`/api/documents/${serverId}/validate`, { method: 'POST' })
  return res.ok
}

async function startApprovalFlow(
  action: OfflineAction,
  serverIdMap: Map<string, string>
): Promise<boolean> {
  const serverId = serverIdMap.get(action.draftId)
  if (!serverId) return false

  const res = await fetch(`/api/documents/${serverId}/approvals`, { method: 'POST' })
  return res.ok
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function markFailed(action: OfflineAction, error: string): Promise<void> {
  const retries = action.retries + 1
  await queueDb.put({
    ...action,
    status: retries >= MAX_RETRIES ? 'failed' : 'pending',
    retries,
    lastError: error,
  })
}

function dataUrlToBlob(dataUrl: string, mimeType: string): Blob {
  const base64 = dataUrl.split(',')[1] ?? dataUrl
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: mimeType })
}
