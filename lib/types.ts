export type Channel = 'whatsapp' | 'instagram' | 'simulador'

export type Tone = 'cercano' | 'formal' | 'directo'

export interface AgentConfig {
  agentName: string
  businessName: string
  industry: string
  description: string
  goals: string
  tone: Tone
  channels: Channel[]
  configuredAt: string
}

/**
 * Credenciales de canal propias de cada negocio. El token puede quedar vacío y
 * caer al de las variables de entorno: una sola app de Meta con un system user
 * token puede operar varios números/cuentas, que es el caso típico de una
 * agencia administrando a sus clientes.
 */
export interface ChannelCredentials {
  whatsappPhoneNumberId: string | null
  whatsappAccessToken: string | null
  instagramPageId: string | null
  instagramAccessToken: string | null
}

/** Un servicio que se puede reservar: define cuánto dura y cuánto sale. */
export interface Service {
  id: string
  businessId: string
  name: string
  durationMinutes: number
  price: string
}

/** Una persona del equipo que atiende (manicurista, estilista, dentista, mesero...). */
export interface Professional {
  id: string
  businessId: string
  name: string
}

/** Horario de atención de un día. `null` = cerrado ese día. */
export interface DayHours {
  open: string
  close: string
}

/** Índice 0 = domingo, 6 = sábado. */
export type WeekHours = (DayHours | null)[]

export const DEFAULT_WEEK_HOURS: WeekHours = [
  null,
  { open: '09:00', close: '18:00' },
  { open: '09:00', close: '18:00' },
  { open: '09:00', close: '18:00' },
  { open: '09:00', close: '18:00' },
  { open: '09:00', close: '18:00' },
  null,
]

export type AppointmentStatus = 'confirmado' | 'cancelado'

export interface Appointment {
  id: string
  businessId: string
  conversationId: string | null
  serviceId: string | null
  serviceName: string
  /** Quién atiende; null si el negocio no maneja personal. */
  professionalId: string | null
  professionalName: string | null
  contactName: string
  contactHandle: string
  /**
   * Fecha y hora local del negocio, sin zona horaria ("2026-08-07T14:00").
   * Un negocio atiende en un solo lugar, así que guardar la hora local evita
   * toda la clase de errores de conversión de zonas.
   */
  startsAt: string
  durationMinutes: number
  status: AppointmentStatus
  createdAt: string
}

export interface Product {
  id: string
  businessId: string
  name: string
  price: number
  /** Unidades disponibles. `null` = sin control de stock (siempre disponible). */
  stock: number | null
  /** Permite dar de baja un producto sin borrarlo ni tocar el stock. */
  active: boolean
  /**
   * Cuándo se subió la foto (ms desde epoch), o `null` si no tiene. Sirve para
   * saber si hay foto y como `?v=` de la dirección, así el navegador no usa una
   * foto vieja después de cambiarla.
   */
  imageVersion: number | null
}

export interface OrderItem {
  productId: string
  name: string
  unitPrice: number
  quantity: number
}

export type OrderStatus = 'pendiente' | 'entregado' | 'cancelado'

/** Cobro antes de preparar: no_aplica = el negocio no lo pide. */
export type PaymentStatus = 'no_aplica' | 'esperando' | 'revisar' | 'pagado' | 'vencido'
export type PaymentMethod = 'transferencia' | 'mercadopago'

export interface Order {
  id: string
  businessId: string
  conversationId: string | null
  contactName: string
  contactHandle: string
  items: OrderItem[]
  total: number
  note: string
  status: OrderStatus
  createdAt: string
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod | null
  paymentDeadline: string | null
  paymentLink: string | null
  paidAt: string | null
  kitchenPrintedAt: string | null
  /** Revisión automática del comprobante que mandó el cliente (ver lib/receipts.ts). */
  receiptCheck: {
    verdict: 'coincide' | 'dudoso' | 'no_coincide' | 'ilegible'
    items: { label: string; ok: boolean | null; detail: string }[]
    readAt: string
  } | null
}

/** Cobros, cocina e inventario (ver SalesSettings en el esquema). */
export interface SalesSettings {
  paymentsEnabled: boolean
  transferInfo: string
  holdMinutes: number
  /** El token nunca sale del servidor: solo si está conectado. */
  mercadoPagoConnected: boolean
  kitchenEnabled: boolean
  /** Confirmar solo cuando el comprobante calza en todo. */
  autoConfirmReceipts: boolean
  stockAlertsEnabled: boolean
  stockAlertThreshold: number
  /** Recibir pedidos solo en horario (ver lib/orderWindow.ts). */
  ordersOnlyInHours: boolean
  preorderMinutes: number
  orderCutoffMinutes: number
}

export interface Business {
  id: string
  templateId: string
  config: AgentConfig
  credentials: ChannelCredentials
  hours: WeekHours
  createdAt: string
  /** null = sin logo cargado; usa el emoji del rubro como respaldo. */
  logoVersion: number | null
}

export type MessageSender = 'contact' | 'agent' | 'human'

export interface Message {
  id: string
  sender: MessageSender
  text: string
  timestamp: string
}

export type ConversationStatus = 'abierta' | 'calificada' | 'cerrada'

export interface Conversation {
  id: string
  businessId: string
  channel: Channel
  contactName: string
  contactHandle: string
  status: ConversationStatus
  messages: Message[]
  notes: string
  /** Una persona tomó la conversación: el agente no contesta solo. */
  agentPaused: boolean
  /** Motivo de la derivación, si la hizo el agente. */
  handoffReason: string
  createdAt: string
  updatedAt: string
}

export type KnowledgeSource = 'manual' | 'web' | 'instagram'

export interface KnowledgeEntry {
  id: string
  businessId: string
  title: string
  content: string
  sourceType: KnowledgeSource
  sourceUrl: string | null
  updatedAt: string
}

