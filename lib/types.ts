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
  title: string
  content: string
  sourceType: KnowledgeSource
  sourceUrl: string | null
  updatedAt: string
}

export interface Store {
  config: AgentConfig | null
  conversations: Conversation[]
  knowledge: KnowledgeEntry[]
}
