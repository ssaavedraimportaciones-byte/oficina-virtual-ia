import type { AgentConfig, Business } from './types'

export interface PublicBusiness {
  id: string
  templateId: string
  config: AgentConfig
  createdAt: string
  /** Estado de los canales, sin exponer nunca los tokens al navegador. */
  channels: {
    whatsapp: { connected: boolean; accountId: string | null }
    instagram: { connected: boolean; accountId: string | null }
  }
}

export function toPublicBusiness(business: Business): PublicBusiness {
  const { credentials } = business
  return {
    id: business.id,
    templateId: business.templateId,
    config: business.config,
    createdAt: business.createdAt,
    channels: {
      whatsapp: {
        connected: Boolean(credentials.whatsappPhoneNumberId),
        accountId: credentials.whatsappPhoneNumberId,
      },
      instagram: {
        connected: Boolean(credentials.instagramPageId),
        accountId: credentials.instagramPageId,
      },
    },
  }
}
