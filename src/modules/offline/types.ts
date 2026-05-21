import type { DocumentType } from '@/types/document'

// ── Local draft ───────────────────────────────────────────────────────────────

export type DraftSyncStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'error'

export interface LocalDraft {
  id: string                        // "local_{uuid}" until synced
  serverId?: string                 // set after successful upload
  folio: string                     // "SC-OFFLINE-{yyMMdd}-{n}" until synced
  type: DocumentType
  taskName: string
  workArea: string
  companyId: string
  createdById: string
  supervisorId?: string
  fields: { name: string; value: string }[]
  syncStatus: DraftSyncStatus
  serverStatus?: string             // last known server document status
  createdAt: string                 // ISO
  updatedAt: string
  syncedAt?: string
}

// ── Offline action queue ──────────────────────────────────────────────────────

export type OfflineActionType =
  | 'CREATE_DOCUMENT'
  | 'ADD_SIGNATURE'
  | 'SAVE_PHOTO'
  | 'VALIDATE_DOCUMENT'
  | 'START_APPROVAL_FLOW'

export interface OfflineAction {
  id: string
  draftId: string                   // links to a LocalDraft
  type: OfflineActionType
  payload: Record<string, unknown>
  status: 'pending' | 'processing' | 'done' | 'failed'
  retries: number
  lastError?: string
  createdAt: string
}

// ── Offline photo ─────────────────────────────────────────────────────────────

export interface OfflinePhoto {
  id: string
  draftId: string
  dataUrl: string                   // base64 data URL
  mimeType: string
  sizeBytes: number
  caption?: string
  capturedAt: string
  syncStatus: 'pending' | 'synced' | 'failed'
  serverUrl?: string
}

// ── Conflict ──────────────────────────────────────────────────────────────────

export type ConflictType =
  | 'SERVER_APPROVED'               // server approved while local pending
  | 'SERVER_REJECTED'
  | 'SERVER_CLOSED'
  | 'FIELD_MISMATCH'                // both sides edited the same fields

export interface ConflictInfo {
  id: string
  draftId: string
  serverId: string
  conflictType: ConflictType
  localVersion: LocalDraft
  serverVersion: ServerDocumentSnapshot
  detectedAt: string
  resolvedAt?: string
  resolution?: 'server_wins' | 'local_wins' | 'merged'
}

export interface ServerDocumentSnapshot {
  id: string
  folio: string
  status: string
  taskName: string
  workArea: string
  type: string
  updatedAt: string
}

// ── Sync result ───────────────────────────────────────────────────────────────

export interface SyncResult {
  attempted: number
  succeeded: number
  failed: number
  conflicts: number
  errors: { actionId: string; error: string }[]
}

// ── Network status ────────────────────────────────────────────────────────────

export type NetworkStatus = 'online' | 'offline' | 'syncing' | 'synced' | 'conflict'
