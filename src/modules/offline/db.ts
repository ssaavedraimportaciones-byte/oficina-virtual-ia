/**
 * Minimal IndexedDB wrapper — no external dependencies.
 * Lazy-initialised, SSR-safe (guarded by typeof window check).
 */

import type { LocalDraft, OfflineAction, OfflinePhoto, ConflictInfo } from './types'

const DB_NAME = 'safecheck-offline'
const DB_VERSION = 1

type StoreName = 'drafts' | 'queue' | 'photos' | 'conflicts'

let dbPromise: Promise<IDBDatabase> | null = null

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window
}

function openDb(): Promise<IDBDatabase> {
  if (!isSupported()) return Promise.reject(new Error('IndexedDB not available'))
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains('drafts')) {
        const drafts = db.createObjectStore('drafts', { keyPath: 'id' })
        drafts.createIndex('syncStatus', 'syncStatus', { unique: false })
        drafts.createIndex('createdById', 'createdById', { unique: false })
      }

      if (!db.objectStoreNames.contains('queue')) {
        const queue = db.createObjectStore('queue', { keyPath: 'id' })
        queue.createIndex('status', 'status', { unique: false })
        queue.createIndex('draftId', 'draftId', { unique: false })
      }

      if (!db.objectStoreNames.contains('photos')) {
        const photos = db.createObjectStore('photos', { keyPath: 'id' })
        photos.createIndex('draftId', 'draftId', { unique: false })
        photos.createIndex('syncStatus', 'syncStatus', { unique: false })
      }

      if (!db.objectStoreNames.contains('conflicts')) {
        const conflicts = db.createObjectStore('conflicts', { keyPath: 'id' })
        conflicts.createIndex('draftId', 'draftId', { unique: false })
        conflicts.createIndex('resolvedAt', 'resolvedAt', { unique: false })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror  = () => reject(req.error)
  })

  return dbPromise
}

// ── Generic helpers ───────────────────────────────────────────────────────────

function txPut<T>(store: StoreName, record: T): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx  = db.transaction(store, 'readwrite')
        const req = tx.objectStore(store).put(record)
        req.onsuccess = () => resolve()
        req.onerror   = () => reject(req.error)
      })
  )
}

function txGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx  = db.transaction(store, 'readonly')
        const req = tx.objectStore(store).get(key)
        req.onsuccess = () => resolve(req.result as T | undefined)
        req.onerror   = () => reject(req.error)
      })
  )
}

function txGetAll<T>(store: StoreName): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx  = db.transaction(store, 'readonly')
        const req = tx.objectStore(store).getAll()
        req.onsuccess = () => resolve(req.result as T[])
        req.onerror   = () => reject(req.error)
      })
  )
}

function txGetByIndex<T>(store: StoreName, index: string, value: string): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx  = db.transaction(store, 'readonly')
        const req = tx.objectStore(store).index(index).getAll(value)
        req.onsuccess = () => resolve(req.result as T[])
        req.onerror   = () => reject(req.error)
      })
  )
}

function txDelete(store: StoreName, key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx  = db.transaction(store, 'readwrite')
        const req = tx.objectStore(store).delete(key)
        req.onsuccess = () => resolve()
        req.onerror   = () => reject(req.error)
      })
  )
}

// ── Drafts ────────────────────────────────────────────────────────────────────

export const draftsDb = {
  put:    (d: LocalDraft)  => txPut<LocalDraft>('drafts', d),
  get:    (id: string)     => txGet<LocalDraft>('drafts', id),
  getAll: ()               => txGetAll<LocalDraft>('drafts'),
  getPending: ()           => txGetByIndex<LocalDraft>('drafts', 'syncStatus', 'pending'),
  delete: (id: string)     => txDelete('drafts', id),
}

// ── Queue ─────────────────────────────────────────────────────────────────────

export const queueDb = {
  put:        (a: OfflineAction) => txPut<OfflineAction>('queue', a),
  get:        (id: string)       => txGet<OfflineAction>('queue', id),
  getAll:     ()                 => txGetAll<OfflineAction>('queue'),
  getPending: ()                 => txGetByIndex<OfflineAction>('queue', 'status', 'pending'),
  delete:     (id: string)       => txDelete('queue', id),
}

// ── Photos ────────────────────────────────────────────────────────────────────

export const photosDb = {
  put:        (p: OfflinePhoto)  => txPut<OfflinePhoto>('photos', p),
  get:        (id: string)       => txGet<OfflinePhoto>('photos', id),
  getAll:     ()                 => txGetAll<OfflinePhoto>('photos'),
  getByDraft: (draftId: string)  => txGetByIndex<OfflinePhoto>('photos', 'draftId', draftId),
  getPending: ()                 => txGetByIndex<OfflinePhoto>('photos', 'syncStatus', 'pending'),
  delete:     (id: string)       => txDelete('photos', id),
}

// ── Conflicts ─────────────────────────────────────────────────────────────────

export const conflictsDb = {
  put:           (c: ConflictInfo) => txPut<ConflictInfo>('conflicts', c),
  get:           (id: string)      => txGet<ConflictInfo>('conflicts', id),
  getAll:        ()                => txGetAll<ConflictInfo>('conflicts'),
  getByDraft:    (draftId: string) => txGetByIndex<ConflictInfo>('conflicts', 'draftId', draftId),
  getUnresolved: async () => {
    const all = await txGetAll<ConflictInfo>('conflicts')
    return all.filter((c) => !c.resolvedAt)
  },
  delete: (id: string) => txDelete('conflicts', id),
}
