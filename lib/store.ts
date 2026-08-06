import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'
import type { AgentConfig, Conversation, KnowledgeEntry, Message, Store } from './types'

// Prototipo: persistencia en un archivo JSON local. Para producción con más de
// una instancia en simultáneo, reemplazar por una base de datos real
// (Firebase/Postgres) manteniendo la misma interfaz de funciones.
const DB_PATH = process.env.DB_PATH || '.data/store.json'

const EMPTY_STORE: Store = { config: null, conversations: [], knowledge: [] }

function withDefaultNotes(conversation: Partial<Conversation>): Conversation {
  if (typeof conversation.notes === 'string') return conversation as Conversation
  return { ...conversation, notes: '' } as Conversation
}

function withDefaultSourceType(entry: Partial<KnowledgeEntry>): KnowledgeEntry {
  if (entry.sourceType) return entry as KnowledgeEntry
  return { ...entry, sourceType: 'manual' } as KnowledgeEntry
}

async function readStore(): Promise<Store> {
  try {
    const raw = await readFile(DB_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Store>
    const store = { ...EMPTY_STORE, ...parsed }
    // Compatibilidad con datos guardados antes de agregar estos campos.
    store.conversations = store.conversations.map((c) => withDefaultNotes(c))
    store.knowledge = store.knowledge.map((k) => withDefaultSourceType(k))
    return store
  } catch {
    return { ...EMPTY_STORE }
  }
}

async function writeStore(store: Store): Promise<void> {
  await mkdir(dirname(DB_PATH), { recursive: true })
  await writeFile(DB_PATH, JSON.stringify(store, null, 2), 'utf-8')
}

export async function getConfig(): Promise<AgentConfig | null> {
  const store = await readStore()
  return store.config
}

export async function saveConfig(config: AgentConfig): Promise<AgentConfig> {
  const store = await readStore()
  store.config = config
  await writeStore(store)
  return config
}

export async function listConversations(): Promise<Conversation[]> {
  const store = await readStore()
  return [...store.conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const store = await readStore()
  return store.conversations.find((c) => c.id === id) ?? null
}

export async function findConversationByContact(
  channel: Conversation['channel'],
  contactHandle: string,
): Promise<Conversation | null> {
  const store = await readStore()
  return (
    store.conversations.find((c) => c.channel === channel && c.contactHandle === contactHandle) ??
    null
  )
}

export async function createConversation(
  input: Pick<Conversation, 'channel' | 'contactName' | 'contactHandle'>,
): Promise<Conversation> {
  const store = await readStore()
  const now = new Date().toISOString()
  const conversation: Conversation = {
    id: randomUUID(),
    channel: input.channel,
    contactName: input.contactName,
    contactHandle: input.contactHandle,
    status: 'abierta',
    messages: [],
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
  store.conversations.push(conversation)
  await writeStore(store)
  return conversation
}

export async function appendMessage(
  conversationId: string,
  message: Omit<Message, 'id' | 'timestamp'>,
): Promise<Conversation> {
  const store = await readStore()
  const conversation = store.conversations.find((c) => c.id === conversationId)
  if (!conversation) {
    throw new Error(`Conversación ${conversationId} no encontrada`)
  }
  conversation.messages.push({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...message,
  })
  conversation.updatedAt = new Date().toISOString()
  await writeStore(store)
  return conversation
}

export async function listKnowledge(): Promise<KnowledgeEntry[]> {
  const store = await readStore()
  return [...store.knowledge].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function addKnowledgeEntry(
  input: Pick<KnowledgeEntry, 'title' | 'content' | 'sourceUrl' | 'sourceType'>,
): Promise<KnowledgeEntry> {
  const store = await readStore()
  const entry: KnowledgeEntry = {
    id: randomUUID(),
    title: input.title,
    content: input.content,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    updatedAt: new Date().toISOString(),
  }
  store.knowledge.push(entry)
  await writeStore(store)
  return entry
}

export async function refreshKnowledgeEntry(
  id: string,
  update: Pick<KnowledgeEntry, 'title' | 'content'>,
): Promise<KnowledgeEntry> {
  const store = await readStore()
  const entry = store.knowledge.find((k) => k.id === id)
  if (!entry) {
    throw new Error(`Entrada de conocimiento ${id} no encontrada`)
  }
  entry.title = update.title
  entry.content = update.content
  entry.updatedAt = new Date().toISOString()
  await writeStore(store)
  return entry
}

export async function deleteKnowledgeEntry(id: string): Promise<void> {
  const store = await readStore()
  store.knowledge = store.knowledge.filter((k) => k.id !== id)
  await writeStore(store)
}

export async function setConversationNotes(
  conversationId: string,
  notes: string,
): Promise<Conversation> {
  const store = await readStore()
  const conversation = store.conversations.find((c) => c.id === conversationId)
  if (!conversation) {
    throw new Error(`Conversación ${conversationId} no encontrada`)
  }
  conversation.notes = notes
  await writeStore(store)
  return conversation
}

export async function setConversationStatus(
  conversationId: string,
  status: Conversation['status'],
): Promise<Conversation> {
  const store = await readStore()
  const conversation = store.conversations.find((c) => c.id === conversationId)
  if (!conversation) {
    throw new Error(`Conversación ${conversationId} no encontrada`)
  }
  conversation.status = status
  conversation.updatedAt = new Date().toISOString()
  await writeStore(store)
  return conversation
}
