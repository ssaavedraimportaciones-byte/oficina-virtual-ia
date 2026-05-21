import { prisma } from '@/lib/db/client'
import type { NotificationEvent, RecipientInfo } from './types'
import type { UserRole } from '@/types/user'

// Maps each event to the roles that should receive the notification
const EVENT_ROLES: Record<NotificationEvent, UserRole[]> = {
  DOCUMENT_CREATED: ['SUPERVISOR', 'PREVENTIONIST'],
  DOCUMENT_OBSERVED: ['WORKER', 'SUPERVISOR'],
  DOCUMENT_PENDING_SIGNATURE: ['WORKER', 'SUPERVISOR'],
  DOCUMENT_PENDING_APPROVAL: ['SUPERVISOR', 'PREVENTIONIST', 'CONTRACT_ADMIN'],
  DOCUMENT_APPROVED: ['WORKER', 'SUPERVISOR', 'PREVENTIONIST', 'CONTRACT_ADMIN'],
  DOCUMENT_REJECTED: ['WORKER', 'SUPERVISOR'],
  DOCUMENT_CLOSED: ['SUPERVISOR', 'PREVENTIONIST', 'CONTRACT_ADMIN', 'MANAGER'],
}

/**
 * Returns users who should receive a notification for the given event.
 * Fetches the document to resolve the document's company and specific
 * linked users (creator, supervisor, preventionist), then also fetches
 * all company users whose role matches the event's role list.
 */
export async function getRecipientsForEvent(
  event: NotificationEvent,
  documentId: string,
  excludeIds: string[] = []
): Promise<RecipientInfo[]> {
  const targetRoles = EVENT_ROLES[event]

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      companyId: true,
      createdById: true,
      supervisorId: true,
      preventionistId: true,
    },
  })
  if (!doc) return []

  // Specific linked users that always receive the event regardless of role
  const directUserIds = new Set<string>()

  if (event === 'DOCUMENT_OBSERVED' || event === 'DOCUMENT_REJECTED') {
    if (doc.createdById) directUserIds.add(doc.createdById)
  }
  if (event === 'DOCUMENT_PENDING_SIGNATURE' || event === 'DOCUMENT_APPROVED') {
    if (doc.createdById) directUserIds.add(doc.createdById)
    if (doc.supervisorId) directUserIds.add(doc.supervisorId)
  }
  if (event === 'DOCUMENT_PENDING_APPROVAL' || event === 'DOCUMENT_APPROVED') {
    if (doc.supervisorId) directUserIds.add(doc.supervisorId)
    if (doc.preventionistId) directUserIds.add(doc.preventionistId)
  }

  // All company users with matching roles
  const byRole = await prisma.user.findMany({
    where: {
      companyId: doc.companyId,
      role: { in: targetRoles },
      isActive: true,
    },
    select: { id: true, name: true, email: true, phone: true, role: true },
  })

  // Merge: role-based users + directly linked users
  const userMap = new Map<string, RecipientInfo>()

  for (const u of byRole) {
    userMap.set(u.id, { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role as UserRole })
  }

  if (directUserIds.size > 0) {
    const directUsers = await prisma.user.findMany({
      where: { id: { in: [...directUserIds] }, isActive: true },
      select: { id: true, name: true, email: true, phone: true, role: true },
    })
    for (const u of directUsers) {
      userMap.set(u.id, { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role as UserRole })
    }
  }

  // Exclude specified IDs (e.g., the person who triggered the event)
  for (const id of excludeIds) userMap.delete(id)

  return [...userMap.values()]
}
