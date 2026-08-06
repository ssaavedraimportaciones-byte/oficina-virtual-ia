import { z } from 'zod'

export const agentConfigSchema = z.object({
  agentName: z.string().min(1),
  businessName: z.string().min(1),
  industry: z.string().min(1),
  description: z.string().min(1),
  goals: z.string().min(1),
  tone: z.enum(['cercano', 'formal', 'directo']),
  channels: z.array(z.enum(['whatsapp', 'instagram', 'simulador'])).min(1),
})

export const credentialsSchema = z.object({
  whatsappPhoneNumberId: z.string().nullable(),
  whatsappAccessToken: z.string().nullable(),
  instagramPageId: z.string().nullable(),
  instagramAccessToken: z.string().nullable(),
})
