import { conflictsDb } from './db'
import type { ConflictInfo, ConflictType, LocalDraft, ServerDocumentSnapshot } from './types'

// Statuses that mean the server document is immutable — local pending copy must not overwrite
const TERMINAL_STATUSES = new Set(['APPROVED', 'CLOSED', 'ARCHIVED'])

function localId(): string {
  return `conflict_${crypto.randomUUID()}`
}

/**
 * Fetches the server version of a document and determines whether a conflict
 * exists relative to the local draft.
 *
 * Returns a ConflictInfo if there is a conflict, null if safe to sync.
 */
export async function detectConflict(
  localDraft: LocalDraft,
  serverId: string
): Promise<ConflictInfo | null> {
  let serverDoc: ServerDocumentSnapshot

  try {
    const res = await fetch(`/api/documents/${serverId}`, {
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (!res.ok) return null // server doc not found — no conflict, proceed
    const json = await res.json()
    const d = json.document ?? json
    serverDoc = {
      id: d.id,
      folio: d.folio,
      status: d.status,
      taskName: d.taskName,
      workArea: d.workArea,
      type: d.type,
      updatedAt: d.updatedAt ?? new Date().toISOString(),
    }
  } catch {
    // Network error — cannot determine conflict, defer
    return null
  }

  // Determine conflict type
  let conflictType: ConflictType | null = null

  if (TERMINAL_STATUSES.has(serverDoc.status)) {
    if (serverDoc.status === 'APPROVED') conflictType = 'SERVER_APPROVED'
    else if (serverDoc.status === 'REJECTED') conflictType = 'SERVER_REJECTED'
    else conflictType = 'SERVER_CLOSED'
  } else if (
    serverDoc.taskName !== localDraft.taskName ||
    serverDoc.workArea !== localDraft.workArea
  ) {
    // Both sides edited core fields
    conflictType = 'FIELD_MISMATCH'
  }

  if (!conflictType) return null

  const conflict: ConflictInfo = {
    id: localId(),
    draftId: localDraft.id,
    serverId,
    conflictType,
    localVersion: localDraft,
    serverVersion: serverDoc,
    detectedAt: new Date().toISOString(),
  }

  await conflictsDb.put(conflict)
  return conflict
}

/**
 * Returns all unresolved conflicts.
 */
export async function getUnresolvedConflicts(): Promise<ConflictInfo[]> {
  return conflictsDb.getUnresolved()
}
