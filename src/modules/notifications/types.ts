import type { UserRole } from '@/types/user'

export type NotificationEvent =
  | 'DOCUMENT_CREATED'
  | 'DOCUMENT_OBSERVED'
  | 'DOCUMENT_PENDING_SIGNATURE'
  | 'DOCUMENT_PENDING_APPROVAL'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_REJECTED'
  | 'DOCUMENT_CLOSED'

export type ChannelType = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP'

export interface NotificationPayload {
  event: NotificationEvent
  documentId: string
  folio: string
  taskName: string
  workArea: string
  initiatorName: string
  comment?: string
}

export interface RecipientInfo {
  id: string
  name: string
  email: string
  phone?: string | null
  role: UserRole
}

export interface SendResult {
  channel: ChannelType
  recipientId: string
  success: boolean
  error?: string
  notificationId?: string
}

export interface NotificationRecord {
  id: string
  documentId: string | null
  recipientId: string
  channel: ChannelType
  status: 'PENDING' | 'SENT' | 'FAILED' | 'READ'
  message: string | null
  sentAt: Date | null
  createdAt: Date
  recipient: { name: string; email: string }
  document: { folio: string; taskName: string } | null
}
