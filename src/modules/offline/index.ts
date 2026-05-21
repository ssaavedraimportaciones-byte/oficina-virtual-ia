// Offline-first via Service Worker (@ducanh2912/next-pwa) + IndexedDB
// Drafts are stored locally and synced when connectivity is restored.

export { saveLocalDraft, saveLocalPhoto, saveLocalSignature, getPendingDrafts, getDraftsForUser } from './saveLocalDraft'
export { queueOfflineAction, getPendingActions, clearDoneActions } from './queueOfflineAction'
export { syncPendingActions } from './syncPendingActions'
export { detectConflict, getUnresolvedConflicts } from './detectConflict'
export { resolveConflict } from './resolveConflict'
export { isSupported } from './db'
export { draftsDb, queueDb, photosDb, conflictsDb } from './db'

export type {
  LocalDraft,
  DraftSyncStatus,
  OfflineAction,
  OfflineActionType,
  OfflinePhoto,
  ConflictInfo,
  ConflictType,
  ServerDocumentSnapshot,
  SyncResult,
  NetworkStatus,
} from './types'
