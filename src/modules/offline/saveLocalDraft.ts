import { draftsDb, photosDb, isSupported } from './db'
import type { LocalDraft, OfflinePhoto } from './types'
import type { DocumentType } from '@/types/document'

let localCounter = 0

function generateLocalFolio(): string {
  const now = new Date()
  const yyMMdd = now.toISOString().slice(2, 10).replace(/-/g, '')
  localCounter++
  return `SC-OFFLINE-${yyMMdd}-${String(localCounter).padStart(3, '0')}`
}

function localId(): string {
  return `local_${crypto.randomUUID()}`
}

interface SaveDraftInput {
  id?: string
  type: DocumentType
  taskName: string
  workArea: string
  companyId: string
  createdById: string
  supervisorId?: string
  fields?: { name: string; value: string }[]
}

/**
 * Saves or updates a document draft in IndexedDB.
 * Returns the draft ID. Safe to call repeatedly — upsert semantics.
 */
export async function saveLocalDraft(input: SaveDraftInput): Promise<LocalDraft> {
  if (!isSupported()) throw new Error('IndexedDB no disponible en este entorno')

  const now = new Date().toISOString()
  const isNew = !input.id

  let draft: LocalDraft

  if (!isNew && input.id) {
    const existing = await draftsDb.get(input.id)
    if (existing) {
      draft = {
        ...existing,
        type: input.type,
        taskName: input.taskName,
        workArea: input.workArea,
        supervisorId: input.supervisorId ?? existing.supervisorId,
        fields: input.fields ?? existing.fields,
        updatedAt: now,
      }
    } else {
      // id provided but not found — treat as new
      draft = buildNewDraft(input, now)
    }
  } else {
    draft = buildNewDraft(input, now)
  }

  await draftsDb.put(draft)
  return draft
}

function buildNewDraft(input: SaveDraftInput, now: string): LocalDraft {
  return {
    id: input.id ?? localId(),
    folio: generateLocalFolio(),
    type: input.type,
    taskName: input.taskName,
    workArea: input.workArea,
    companyId: input.companyId,
    createdById: input.createdById,
    supervisorId: input.supervisorId,
    fields: input.fields ?? [],
    syncStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Saves a photo (as base64 data URL) associated with a draft.
 */
export async function saveLocalPhoto(params: {
  draftId: string
  dataUrl: string
  mimeType: string
  caption?: string
}): Promise<OfflinePhoto> {
  if (!isSupported()) throw new Error('IndexedDB no disponible')

  const sizeBytes = Math.round((params.dataUrl.length * 3) / 4)
  const photo: OfflinePhoto = {
    id: localId(),
    draftId: params.draftId,
    dataUrl: params.dataUrl,
    mimeType: params.mimeType,
    sizeBytes,
    caption: params.caption,
    capturedAt: new Date().toISOString(),
    syncStatus: 'pending',
  }
  await photosDb.put(photo)
  return photo
}

/**
 * Saves a captured signature (canvas data URL) associated with a draft.
 * Stored as a photo with mimeType 'image/png' and caption '__signature__'.
 */
export async function saveLocalSignature(params: {
  draftId: string
  imageDataUrl: string
  signerName: string
  method: string
}): Promise<OfflinePhoto> {
  return saveLocalPhoto({
    draftId: params.draftId,
    dataUrl: params.imageDataUrl,
    mimeType: 'image/png',
    caption: `__signature__:${params.method}:${params.signerName}`,
  })
}

/**
 * Returns all pending (unsynced) drafts, newest first.
 */
export async function getPendingDrafts(): Promise<LocalDraft[]> {
  if (!isSupported()) return []
  const all = await draftsDb.getAll()
  return all
    .filter((d) => d.syncStatus === 'pending' || d.syncStatus === 'error')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Returns all drafts for a specific user, sorted newest first.
 */
export async function getDraftsForUser(userId: string): Promise<LocalDraft[]> {
  if (!isSupported()) return []
  const all = await draftsDb.getAll()
  return all
    .filter((d) => d.createdById === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
