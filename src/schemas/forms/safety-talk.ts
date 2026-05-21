import { z } from 'zod'

export const safetyTalkSchema = z.object({
  empresa: z.string().min(2, 'Empresa requerida'),
  area: z.string().min(2, 'Área requerida'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida (HH:MM)'),
  tema: z.string().min(5, 'Tema requerido'),
  relator: z.string().min(2, 'Nombre del relator requerido'),
  participantes: z
    .array(z.object({ nombre: z.string().min(2), rut: z.string().min(8) }))
    .min(1, 'Debe haber al menos un participante'),
  riesgosTratados: z.array(z.string().min(2)).min(1, 'Debe indicar al menos un riesgo'),
  controlesTratados: z.array(z.string().min(2)).min(1, 'Debe indicar al menos un control'),
  observaciones: z.string().optional(),
})

export type SafetyTalkInput = z.infer<typeof safetyTalkSchema>
