import { z } from 'zod'

const artItemSchema = z.object({
  actividad: z.string().min(3, 'Actividad requerida'),
  peligro: z.string().min(3, 'Peligro requerido'),
  riesgo: z.string().min(3, 'Riesgo requerido'),
  consecuencia: z.string().min(3, 'Consecuencia requerida'),
  control: z.string().min(3, 'Medida de control requerida'),
  responsable: z.string().min(2, 'Responsable requerido'),
  validado: z.boolean().default(false),
})

export const artSchema = z.object({
  items: z.array(artItemSchema).min(1, 'Debe agregar al menos una actividad'),
})

export type ARTInput = z.infer<typeof artSchema>
export type ARTItem = z.infer<typeof artItemSchema>
