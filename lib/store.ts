import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'
import type {
  AgentConfig,
  Appointment,
  Business,
  ChannelCredentials,
  Conversation,
  KnowledgeEntry,
  Message,
  Service,
  Store,
  WeekHours,
} from './types'
import { DEFAULT_WEEK_HOURS } from './types'

// Prototipo: persistencia en un archivo JSON local. Para producción con más de
// una instancia en simultáneo, reemplazar por una base de datos real
// (Firebase/Postgres) manteniendo la misma interfaz de funciones.
const DB_PATH = process.env.DB_PATH || '.data/store.json'

const EMPTY_STORE: Store = {
  businesses: [],
  conversations: [],
  knowledge: [],
  services: [],
  appointments: [],
}

export const EMPTY_CREDENTIALS: ChannelCredentials = {
  whatsappPhoneNumberId: null,
  whatsappAccessToken: null,
  instagramPageId: null,
  instagramAccessToken: null,
}

async function readStore(): Promise<Store> {
  try {
    const raw = await readFile(DB_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Store>
    const store = { ...EMPTY_STORE, ...parsed }
    // Compatibilidad con negocios guardados antes de que existiera la agenda.
    store.businesses = store.businesses.map((b) =>
      b.hours ? b : { ...b, hours: DEFAULT_WEEK_HOURS },
    )
    return store
  } catch {
    return { ...EMPTY_STORE }
  }
}

async function writeStore(store: Store): Promise<void> {
  await mkdir(dirname(DB_PATH), { recursive: true })
  await writeFile(DB_PATH, JSON.stringify(store, null, 2), 'utf-8')
}

// --- Negocios (tenants) ---

export async function listBusinesses(): Promise<Business[]> {
  const store = await readStore()
  return [...store.businesses].sort((a, b) => a.config.businessName.localeCompare(b.config.businessName))
}

export async function getBusiness(id: string): Promise<Business | null> {
  const store = await readStore()
  return store.businesses.find((b) => b.id === id) ?? null
}

export async function createBusiness(
  config: AgentConfig,
  templateId: string,
): Promise<Business> {
  const store = await readStore()
  const business: Business = {
    id: randomUUID(),
    templateId,
    config,
    credentials: { ...EMPTY_CREDENTIALS },
    hours: DEFAULT_WEEK_HOURS,
    createdAt: new Date().toISOString(),
  }
  store.businesses.push(business)
  await writeStore(store)
  return business
}

export async function updateBusinessConfig(
  id: string,
  config: AgentConfig,
): Promise<Business> {
  const store = await readStore()
  const business = store.businesses.find((b) => b.id === id)
  if (!business) {
    throw new Error(`Negocio ${id} no encontrado`)
  }
  business.config = config
  await writeStore(store)
  return business
}

export async function updateBusinessCredentials(
  id: string,
  credentials: ChannelCredentials,
): Promise<Business> {
  const store = await readStore()
  const business = store.businesses.find((b) => b.id === id)
  if (!business) {
    throw new Error(`Negocio ${id} no encontrado`)
  }
  business.credentials = credentials
  await writeStore(store)
  return business
}

export async function deleteBusiness(id: string): Promise<void> {
  const store = await readStore()
  store.businesses = store.businesses.filter((b) => b.id !== id)
  store.conversations = store.conversations.filter((c) => c.businessId !== id)
  store.knowledge = store.knowledge.filter((k) => k.businessId !== id)
  await writeStore(store)
}

/**
 * Encuentra a qué negocio pertenece un mensaje entrante, según el número de
 * WhatsApp o la cuenta de Instagram a la que le escribieron. Es lo que permite
 * que un mismo webhook atienda a todos los clientes de la plataforma.
 */
export async function findBusinessByChannelId(
  channel: 'whatsapp' | 'instagram',
  channelId: string,
): Promise<Business | null> {
  const store = await readStore()
  const match = store.businesses.find((b) =>
    channel === 'whatsapp'
      ? b.credentials.whatsappPhoneNumberId === channelId
      : b.credentials.instagramPageId === channelId,
  )
  if (match) return match

  // Fallback single-tenant: si hay un único negocio y todavía no cargó el ID
  // del canal, se le atribuyen los mensajes entrantes igual.
  if (store.businesses.length === 1) return store.businesses[0]
  return null
}

// --- Conversaciones ---

export async function listConversations(businessId: string): Promise<Conversation[]> {
  const store = await readStore()
  return store.conversations
    .filter((c) => c.businessId === businessId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const store = await readStore()
  return store.conversations.find((c) => c.id === id) ?? null
}

export async function findConversationByContact(
  businessId: string,
  channel: Conversation['channel'],
  contactHandle: string,
): Promise<Conversation | null> {
  const store = await readStore()
  return (
    store.conversations.find(
      (c) =>
        c.businessId === businessId &&
        c.channel === channel &&
        c.contactHandle === contactHandle,
    ) ?? null
  )
}

export async function createConversation(
  input: Pick<Conversation, 'businessId' | 'channel' | 'contactName' | 'contactHandle'>,
): Promise<Conversation> {
  const store = await readStore()
  const now = new Date().toISOString()
  const conversation: Conversation = {
    id: randomUUID(),
    businessId: input.businessId,
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

// --- Agenda: horarios, servicios y turnos ---

export async function updateBusinessHours(id: string, hours: WeekHours): Promise<Business> {
  const store = await readStore()
  const business = store.businesses.find((b) => b.id === id)
  if (!business) {
    throw new Error(`Negocio ${id} no encontrado`)
  }
  business.hours = hours
  await writeStore(store)
  return business
}

export async function listServices(businessId: string): Promise<Service[]> {
  const store = await readStore()
  return store.services.filter((s) => s.businessId === businessId)
}

export async function addService(
  input: Pick<Service, 'businessId' | 'name' | 'durationMinutes' | 'price'>,
): Promise<Service> {
  const store = await readStore()
  const service: Service = { id: randomUUID(), ...input }
  store.services.push(service)
  await writeStore(store)
  return service
}

export async function deleteService(id: string): Promise<void> {
  const store = await readStore()
  store.services = store.services.filter((s) => s.id !== id)
  await writeStore(store)
}

export async function listAppointments(businessId: string): Promise<Appointment[]> {
  const store = await readStore()
  return store.appointments
    .filter((a) => a.businessId === businessId)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

export async function addAppointment(
  input: Omit<Appointment, 'id' | 'status' | 'createdAt'>,
): Promise<Appointment> {
  const store = await readStore()
  const appointment: Appointment = {
    id: randomUUID(),
    ...input,
    status: 'confirmado',
    createdAt: new Date().toISOString(),
  }
  store.appointments.push(appointment)
  await writeStore(store)
  return appointment
}

export async function cancelAppointment(id: string): Promise<Appointment> {
  const store = await readStore()
  const appointment = store.appointments.find((a) => a.id === id)
  if (!appointment) {
    throw new Error(`Turno ${id} no encontrado`)
  }
  appointment.status = 'cancelado'
  await writeStore(store)
  return appointment
}

export interface BusinessOverview {
  business: Business
  conversationCount: number
  messageCount: number
  knowledgeCount: number
  lastActivityAt: string | null
}

/** Resumen de toda la plataforma para el panel de administración. */
export async function getAdminOverview(): Promise<BusinessOverview[]> {
  const store = await readStore()
  return store.businesses
    .map((business) => {
      const conversations = store.conversations.filter((c) => c.businessId === business.id)
      const lastActivityAt = conversations.reduce<string | null>(
        (latest, c) => (latest === null || c.updatedAt > latest ? c.updatedAt : latest),
        null,
      )
      return {
        business,
        conversationCount: conversations.length,
        messageCount: conversations.reduce((sum, c) => sum + c.messages.length, 0),
        knowledgeCount: store.knowledge.filter((k) => k.businessId === business.id).length,
        lastActivityAt,
      }
    })
    .sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''))
}

// --- Base de conocimiento ---

export async function listKnowledge(businessId: string): Promise<KnowledgeEntry[]> {
  const store = await readStore()
  return store.knowledge
    .filter((k) => k.businessId === businessId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function addKnowledgeEntry(
  input: Pick<KnowledgeEntry, 'businessId' | 'title' | 'content' | 'sourceUrl' | 'sourceType'>,
): Promise<KnowledgeEntry> {
  const store = await readStore()
  const entry: KnowledgeEntry = {
    id: randomUUID(),
    businessId: input.businessId,
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
