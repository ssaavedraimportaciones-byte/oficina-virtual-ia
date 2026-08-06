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

export interface Business {
  id: string
  templateId: string
  config: AgentConfig
  credentials: ChannelCredentials
  createdAt: string
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

export interface Store {
  businesses: Business[]
  conversations: Conversation[]
  knowledge: KnowledgeEntry[]
}
