import { prisma } from './db'
import type { Prisma } from './generated/prisma/client'
import { checkOrder, type RequestedItem } from './catalog'
import { decryptOptional, encryptOptional } from './secrets'
import type { SessionUser } from './auth'
import type {
  AgentConfig,
  Appointment,
  AppointmentStatus,
  Business,
  Channel,
  ChannelCredentials,
  Conversation,
  ConversationStatus,
  KnowledgeEntry,
  KnowledgeSource,
  Message,
  MessageSender,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  Service,
  Tone,
  WeekHours,
} from './types'
import { DEFAULT_WEEK_HOURS } from './types'

export const EMPTY_CREDENTIALS: ChannelCredentials = {
  whatsappPhoneNumberId: null,
  whatsappAccessToken: null,
  instagramPageId: null,
  instagramAccessToken: null,
}

// --- Mapeo entre las filas planas de Postgres y los tipos de dominio de la
// app (que anidan config/credentials, como venían del store en JSON). Así
// ningún consumidor —páginas, prompt del agente, herramientas— tuvo que
// cambiar al migrar de archivo a base de datos real. ---

function mapBusiness(row: {
  id: string
  templateId: string
  agentName: string
  businessName: string
  industry: string
  description: string
  goals: string
  tone: string
  channels: string[]
  configuredAt: Date
  whatsappPhoneNumberId: string | null
  whatsappAccessToken: string | null
  instagramPageId: string | null
  instagramAccessToken: string | null
  hours: unknown
  createdAt: Date
}): Business {
  return {
    id: row.id,
    templateId: row.templateId,
    config: {
      agentName: row.agentName,
      businessName: row.businessName,
      industry: row.industry,
      description: row.description,
      goals: row.goals,
      tone: row.tone as Tone,
      channels: row.channels as Channel[],
      configuredAt: row.configuredAt.toISOString(),
    },
    credentials: {
      whatsappPhoneNumberId: row.whatsappPhoneNumberId,
      whatsappAccessToken: row.whatsappAccessToken,
      instagramPageId: row.instagramPageId,
      instagramAccessToken: row.instagramAccessToken,
    },
    hours: (row.hours as WeekHours) ?? DEFAULT_WEEK_HOURS,
    createdAt: row.createdAt.toISOString(),
  }
}

function mapMessage(row: {
  id: string
  sender: string
  text: string
  timestamp: Date
}): Message {
  return {
    id: row.id,
    sender: row.sender as MessageSender,
    text: row.text,
    timestamp: row.timestamp.toISOString(),
  }
}

function mapConversation(row: {
  id: string
  businessId: string
  channel: string
  contactName: string
  contactHandle: string
  status: string
  notes: string
  createdAt: Date
  updatedAt: Date
  messages: Array<{ id: string; sender: string; text: string; timestamp: Date }>
}): Conversation {
  return {
    id: row.id,
    businessId: row.businessId,
    channel: row.channel as Channel,
    contactName: row.contactName,
    contactHandle: row.contactHandle,
    status: row.status as ConversationStatus,
    messages: row.messages.map(mapMessage),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapKnowledge(row: {
  id: string
  businessId: string
  title: string
  content: string
  sourceType: string
  sourceUrl: string | null
  updatedAt: Date
}): KnowledgeEntry {
  return {
    id: row.id,
    businessId: row.businessId,
    title: row.title,
    content: row.content,
    sourceType: row.sourceType as KnowledgeSource,
    sourceUrl: row.sourceUrl,
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapService(row: {
  id: string
  businessId: string
  name: string
  durationMinutes: number
  price: string
}): Service {
  return { ...row }
}

function mapAppointment(row: {
  id: string
  businessId: string
  conversationId: string | null
  serviceId: string | null
  serviceName: string
  contactName: string
  contactHandle: string
  startsAt: string
  durationMinutes: number
  status: string
  createdAt: Date
}): Appointment {
  return {
    id: row.id,
    businessId: row.businessId,
    conversationId: row.conversationId,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    contactName: row.contactName,
    contactHandle: row.contactHandle,
    startsAt: row.startsAt,
    durationMinutes: row.durationMinutes,
    status: row.status as AppointmentStatus,
    createdAt: row.createdAt.toISOString(),
  }
}

function mapProduct(row: {
  id: string
  businessId: string
  name: string
  price: number
  stock: number | null
  active: boolean
}): Product {
  return { ...row }
}

function mapOrder(row: {
  id: string
  businessId: string
  conversationId: string | null
  contactName: string
  contactHandle: string
  total: number
  note: string
  status: string
  createdAt: Date
  items: Array<{ productId: string; name: string; unitPrice: number; quantity: number }>
}): Order {
  return {
    id: row.id,
    businessId: row.businessId,
    conversationId: row.conversationId,
    contactName: row.contactName,
    contactHandle: row.contactHandle,
    items: row.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
    })),
    total: row.total,
    note: row.note,
    status: row.status as OrderStatus,
    createdAt: row.createdAt.toISOString(),
  }
}

// --- Negocios (tenants) ---

export async function listBusinesses(): Promise<Business[]> {
  const rows = await prisma.business.findMany({ orderBy: { businessName: 'asc' } })
  return rows.map(mapBusiness)
}

/** Negocios que puede ver un usuario: todos si es admin de plataforma, solo los suyos si no. */
export async function listBusinessesForUser(user: SessionUser): Promise<Business[]> {
  if (user.role === 'PLATFORM_ADMIN') return listBusinesses()

  const ids = user.businesses.map((b) => b.businessId)
  if (ids.length === 0) return []

  const rows = await prisma.business.findMany({
    where: { id: { in: ids } },
    orderBy: { businessName: 'asc' },
  })
  return rows.map(mapBusiness)
}

export async function getBusiness(id: string): Promise<Business | null> {
  const row = await prisma.business.findUnique({ where: { id } })
  return row ? mapBusiness(row) : null
}

export async function createBusiness(config: AgentConfig, templateId: string): Promise<Business> {
  const row = await prisma.business.create({
    data: {
      templateId,
      agentName: config.agentName,
      businessName: config.businessName,
      industry: config.industry,
      description: config.description,
      goals: config.goals,
      tone: config.tone,
      channels: config.channels,
      hours: DEFAULT_WEEK_HOURS as unknown as Prisma.InputJsonValue,
    },
  })
  return mapBusiness(row)
}

export async function updateBusinessConfig(id: string, config: AgentConfig): Promise<Business> {
  const row = await prisma.business.update({
    where: { id },
    data: {
      agentName: config.agentName,
      businessName: config.businessName,
      industry: config.industry,
      description: config.description,
      goals: config.goals,
      tone: config.tone,
      channels: config.channels,
    },
  })
  return mapBusiness(row)
}

/** Los tokens se guardan cifrados; los IDs de cuenta no son secretos. */
export async function updateBusinessCredentials(
  id: string,
  credentials: ChannelCredentials,
): Promise<Business> {
  const row = await prisma.business.update({
    where: { id },
    data: {
      whatsappPhoneNumberId: credentials.whatsappPhoneNumberId,
      whatsappAccessToken: encryptOptional(credentials.whatsappAccessToken),
      instagramPageId: credentials.instagramPageId,
      instagramAccessToken: encryptOptional(credentials.instagramAccessToken),
    },
  })
  return mapBusiness(row)
}

/**
 * Credenciales listas para usar contra la API de Meta, con los tokens
 * descifrados. Se usa solo en el servidor, al momento de enviar un mensaje.
 */
export function decryptCredentials(credentials: ChannelCredentials): ChannelCredentials {
  return {
    ...credentials,
    whatsappAccessToken: decryptOptional(credentials.whatsappAccessToken),
    instagramAccessToken: decryptOptional(credentials.instagramAccessToken),
  }
}

export async function updateBusinessHours(id: string, hours: WeekHours): Promise<Business> {
  const row = await prisma.business.update({
    where: { id },
    data: { hours: hours as unknown as Prisma.InputJsonValue },
  })
  return mapBusiness(row)
}

export async function deleteBusiness(id: string): Promise<void> {
  // Conversaciones, conocimiento, servicios, turnos, productos y pedidos
  // cuelgan de Business con onDelete: Cascade en el schema.
  await prisma.business.delete({ where: { id } })
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
  const match = await prisma.business.findFirst({
    where:
      channel === 'whatsapp'
        ? { whatsappPhoneNumberId: channelId }
        : { instagramPageId: channelId },
  })
  if (match) return mapBusiness(match)

  // Fallback single-tenant: si hay un único negocio y todavía no cargó el ID
  // del canal, se le atribuyen los mensajes entrantes igual.
  const [only, count] = await Promise.all([
    prisma.business.findFirst(),
    prisma.business.count(),
  ])
  if (count === 1 && only) return mapBusiness(only)
  return null
}

// --- Conversaciones ---

const CONVERSATION_INCLUDE = { messages: { orderBy: { timestamp: 'asc' as const } } }

export async function listConversations(businessId: string): Promise<Conversation[]> {
  const rows = await prisma.conversation.findMany({
    where: { businessId },
    orderBy: { updatedAt: 'desc' },
    include: CONVERSATION_INCLUDE,
  })
  return rows.map(mapConversation)
}

/** Para el badge de "atención" en /panel: cuántas conversaciones siguen abiertas. */
export async function countOpenConversations(businessId: string): Promise<number> {
  return prisma.conversation.count({ where: { businessId, status: 'abierta' } })
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const row = await prisma.conversation.findUnique({
    where: { id },
    include: CONVERSATION_INCLUDE,
  })
  return row ? mapConversation(row) : null
}

export async function findConversationByContact(
  businessId: string,
  channel: Conversation['channel'],
  contactHandle: string,
): Promise<Conversation | null> {
  const row = await prisma.conversation.findUnique({
    where: { businessId_channel_contactHandle: { businessId, channel, contactHandle } },
    include: CONVERSATION_INCLUDE,
  })
  return row ? mapConversation(row) : null
}

export async function createConversation(
  input: Pick<Conversation, 'businessId' | 'channel' | 'contactName' | 'contactHandle'>,
): Promise<Conversation> {
  const row = await prisma.conversation.create({
    data: { ...input, status: 'abierta', notes: '' },
    include: CONVERSATION_INCLUDE,
  })
  return mapConversation(row)
}

export async function appendMessage(
  conversationId: string,
  message: Omit<Message, 'id' | 'timestamp'>,
): Promise<Conversation> {
  const row = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      updatedAt: new Date(),
      messages: { create: { sender: message.sender, text: message.text } },
    },
    include: CONVERSATION_INCLUDE,
  })
  return mapConversation(row)
}

export async function setConversationNotes(
  conversationId: string,
  notes: string,
): Promise<Conversation> {
  const row = await prisma.conversation.update({
    where: { id: conversationId },
    data: { notes },
    include: CONVERSATION_INCLUDE,
  })
  return mapConversation(row)
}

export async function setConversationStatus(
  conversationId: string,
  status: Conversation['status'],
): Promise<Conversation> {
  const row = await prisma.conversation.update({
    where: { id: conversationId },
    data: { status, updatedAt: new Date() },
    include: CONVERSATION_INCLUDE,
  })
  return mapConversation(row)
}

// --- Agenda: servicios y turnos ---

export async function listServices(businessId: string): Promise<Service[]> {
  const rows = await prisma.service.findMany({ where: { businessId } })
  return rows.map(mapService)
}

export async function addService(
  input: Pick<Service, 'businessId' | 'name' | 'durationMinutes' | 'price'>,
): Promise<Service> {
  const row = await prisma.service.create({ data: input })
  return mapService(row)
}

export async function deleteService(id: string): Promise<void> {
  await prisma.service.delete({ where: { id } }).catch(() => {})
}

export async function listAppointments(businessId: string): Promise<Appointment[]> {
  const rows = await prisma.appointment.findMany({
    where: { businessId },
    orderBy: { startsAt: 'asc' },
  })
  return rows.map(mapAppointment)
}

export async function addAppointment(
  input: Omit<Appointment, 'id' | 'status' | 'createdAt'>,
): Promise<Appointment> {
  const row = await prisma.appointment.create({
    data: { ...input, status: 'confirmado' },
  })
  return mapAppointment(row)
}

export async function cancelAppointment(id: string): Promise<Appointment> {
  const row = await prisma.appointment.update({
    where: { id },
    data: { status: 'cancelado' },
  })
  return mapAppointment(row)
}

// --- Catálogo y pedidos ---

export async function listProducts(businessId: string): Promise<Product[]> {
  const rows = await prisma.product.findMany({ where: { businessId } })
  return rows.map(mapProduct)
}

export async function addProduct(
  input: Pick<Product, 'businessId' | 'name' | 'price' | 'stock'>,
): Promise<Product> {
  const row = await prisma.product.create({ data: { ...input, active: true } })
  return mapProduct(row)
}

export async function updateProduct(
  id: string,
  update: Partial<Pick<Product, 'name' | 'price' | 'stock' | 'active'>>,
): Promise<Product> {
  const row = await prisma.product.update({ where: { id }, data: update })
  return mapProduct(row)
}

export async function deleteProduct(id: string): Promise<void> {
  await prisma.product.delete({ where: { id } }).catch(() => {})
}

export async function listOrders(businessId: string): Promise<Order[]> {
  const rows = await prisma.order.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  })
  return rows.map(mapOrder)
}

export type CreateOrderResult = { ok: true; order: Order } | { ok: false; reason: string }

class StockRaceError extends Error {}

/**
 * Crea el pedido y descuenta el stock dentro de una transacción, con un UPDATE
 * condicional por producto (`stock >= cantidad`) en vez de leer-y-luego-escribir.
 * Eso es lo que de verdad evita la sobreventa con varias instancias del server
 * pegándole a la misma base al mismo tiempo: si dos pedidos compiten por la
 * última unidad, el UPDATE de uno de los dos afecta 0 filas y se aborta con un
 * mensaje claro, en vez de que ambos "vean" stock disponible y lo descuenten
 * los dos.
 */
export async function createOrder(input: {
  businessId: string
  conversationId: string | null
  contactName: string
  contactHandle: string
  requested: RequestedItem[]
  note: string
}): Promise<CreateOrderResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const products = (await tx.product.findMany({ where: { businessId: input.businessId } })).map(
        mapProduct,
      )

      const check = checkOrder(products, input.requested)
      if (!check.ok) return check

      for (const { product, quantity } of check.items) {
        if (product.stock === null) continue
        const updated = await tx.product.updateMany({
          where: { id: product.id, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        })
        if (updated.count === 0) {
          throw new StockRaceError(
            `"${product.name}" se quedó sin stock justo ahora. Volvé a consultar el catálogo.`,
          )
        }
      }

      const row = await tx.order.create({
        data: {
          businessId: input.businessId,
          conversationId: input.conversationId,
          contactName: input.contactName,
          contactHandle: input.contactHandle,
          total: check.total,
          note: input.note,
          status: 'pendiente',
          items: {
            create: check.items.map(({ product, quantity }) => ({
              productId: product.id,
              name: product.name,
              unitPrice: product.price,
              quantity,
            })),
          },
        },
        include: { items: true },
      })

      return { ok: true, order: mapOrder(row) }
    })
  } catch (error) {
    if (error instanceof StockRaceError) return { ok: false, reason: error.message }
    throw error
  }
}

export async function setOrderStatus(id: string, status: Order['status']): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } })

    // Cancelar devuelve las unidades al stock; volver a activarlo las descuenta
    // de nuevo, para que el inventario no quede desfasado por un cambio de estado.
    const wasCancelled = existing.status === 'cancelado'
    const willCancel = status === 'cancelado'
    if (wasCancelled !== willCancel) {
      const delta = willCancel ? 1 : -1
      for (const item of existing.items) {
        // updateMany, no update: el producto puede haber sido borrado.
        await tx.product.updateMany({
          where: { id: item.productId, stock: { not: null } },
          data: { stock: { increment: item.quantity * delta } },
        })
      }
      // Un update no puede dejar el stock negativo si canceló dos veces
      // seguidas por error: se recorta a 0 como piso.
      if (willCancel) {
        await tx.product.updateMany({
          where: { businessId: existing.businessId, stock: { lt: 0 } },
          data: { stock: 0 },
        })
      }
    }

    const row = await tx.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    })
    return mapOrder(row)
  })
}

export interface BusinessOverview {
  business: Business
  conversationCount: number
  messageCount: number
  knowledgeCount: number
  pendingOrders: number
  soldOutProducts: number
  lastActivityAt: string | null
}

/** Resumen de toda la plataforma para el panel de administración. */
export async function getAdminOverview(): Promise<BusinessOverview[]> {
  const businesses = await prisma.business.findMany()

  const overview = await Promise.all(
    businesses.map(async (business) => {
      const [
        conversationCount,
        messageCount,
        knowledgeCount,
        pendingOrders,
        soldOutProducts,
        lastConversation,
      ] = await Promise.all([
        prisma.conversation.count({ where: { businessId: business.id } }),
        prisma.message.count({ where: { conversation: { businessId: business.id } } }),
        prisma.knowledgeEntry.count({ where: { businessId: business.id } }),
        prisma.order.count({ where: { businessId: business.id, status: 'pendiente' } }),
        prisma.product.count({
          where: { businessId: business.id, active: true, stock: { lte: 0 } },
        }),
        prisma.conversation.findFirst({
          where: { businessId: business.id },
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true },
        }),
      ])

      return {
        business: mapBusiness(business),
        conversationCount,
        messageCount,
        knowledgeCount,
        pendingOrders,
        soldOutProducts,
        lastActivityAt: lastConversation?.updatedAt.toISOString() ?? null,
      }
    }),
  )

  return overview.sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''))
}

export interface BusinessAnalytics {
  conversationCount: number
  openConversations: number
  messageCount: number
  appointmentCount: number
  confirmedAppointments: number
  orderCount: number
  pendingOrders: number
  revenueTotal: number
  soldOutProducts: number
  knowledgeCount: number
}

/** Resumen para la pestaña "Resumen" del dueño de UN negocio (no toda la plataforma). */
export async function getBusinessAnalytics(businessId: string): Promise<BusinessAnalytics> {
  const [
    conversationCount,
    openConversations,
    messageCount,
    appointmentCount,
    confirmedAppointments,
    orderCount,
    pendingOrders,
    revenueAgg,
    soldOutProducts,
    knowledgeCount,
  ] = await Promise.all([
    prisma.conversation.count({ where: { businessId } }),
    prisma.conversation.count({ where: { businessId, status: 'abierta' } }),
    prisma.message.count({ where: { conversation: { businessId } } }),
    prisma.appointment.count({ where: { businessId } }),
    prisma.appointment.count({ where: { businessId, status: 'confirmado' } }),
    prisma.order.count({ where: { businessId } }),
    prisma.order.count({ where: { businessId, status: 'pendiente' } }),
    prisma.order.aggregate({
      where: { businessId, status: { not: 'cancelado' } },
      _sum: { total: true },
    }),
    prisma.product.count({ where: { businessId, active: true, stock: { lte: 0 } } }),
    prisma.knowledgeEntry.count({ where: { businessId } }),
  ])

  return {
    conversationCount,
    openConversations,
    messageCount,
    appointmentCount,
    confirmedAppointments,
    orderCount,
    pendingOrders,
    revenueTotal: revenueAgg._sum.total ?? 0,
    soldOutProducts,
    knowledgeCount,
  }
}

// --- Base de conocimiento ---

export async function listKnowledge(businessId: string): Promise<KnowledgeEntry[]> {
  const rows = await prisma.knowledgeEntry.findMany({
    where: { businessId },
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map(mapKnowledge)
}

export async function addKnowledgeEntry(
  input: Pick<KnowledgeEntry, 'businessId' | 'title' | 'content' | 'sourceUrl' | 'sourceType'>,
): Promise<KnowledgeEntry> {
  const row = await prisma.knowledgeEntry.create({ data: input })
  return mapKnowledge(row)
}

export async function refreshKnowledgeEntry(
  id: string,
  update: Pick<KnowledgeEntry, 'title' | 'content'>,
): Promise<KnowledgeEntry> {
  const row = await prisma.knowledgeEntry.update({
    where: { id },
    data: { ...update, updatedAt: new Date() },
  })
  return mapKnowledge(row)
}

export async function deleteKnowledgeEntry(id: string): Promise<void> {
  await prisma.knowledgeEntry.delete({ where: { id } }).catch(() => {})
}

// --- Dueño de un recurso ---
// La URL de estas rutas trae solo el id del recurso (no el del negocio), así
// que antes de autorizar hay que resolver de qué negocio es. Se hace con un
// SELECT liviano en vez de traer y mapear el objeto entero.

export async function getKnowledgeEntryBusinessId(id: string): Promise<string | null> {
  const row = await prisma.knowledgeEntry.findUnique({ where: { id }, select: { businessId: true } })
  return row?.businessId ?? null
}

export async function getServiceBusinessId(id: string): Promise<string | null> {
  const row = await prisma.service.findUnique({ where: { id }, select: { businessId: true } })
  return row?.businessId ?? null
}

export async function getAppointmentBusinessId(id: string): Promise<string | null> {
  const row = await prisma.appointment.findUnique({ where: { id }, select: { businessId: true } })
  return row?.businessId ?? null
}

export async function getProductBusinessId(id: string): Promise<string | null> {
  const row = await prisma.product.findUnique({ where: { id }, select: { businessId: true } })
  return row?.businessId ?? null
}

export async function getOrderBusinessId(id: string): Promise<string | null> {
  const row = await prisma.order.findUnique({ where: { id }, select: { businessId: true } })
  return row?.businessId ?? null
}
