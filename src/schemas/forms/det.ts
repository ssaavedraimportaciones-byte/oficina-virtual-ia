import { z } from 'zod'

const pasoTrabajoSchema = z.object({
  descripcion: z.string().min(3, 'Descripción del paso requerida'),
  riesgos: z.array(z.string().min(2)).min(1, 'Al menos un riesgo por paso'),
  controles: z.array(z.string().min(2)).min(1, 'Al menos un control por paso'),
})

export const detSchema = z.object({
  empresa: z.string().min(2, 'Empresa requerida'),
  area: z.string().min(2, 'Área requerida'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  tarea: z.string().min(5, 'Descripción de la tarea requerida'),
  pasosDelTrabajo: z
    .array(pasoTrabajoSchema)
    .min(1, 'Debe definir al menos un paso del trabajo'),
  responsable: z.string().min(2, 'Responsable requerido'),
  supervisor: z.string().min(2, 'Supervisor requerido'),
  trabajadores: z
    .array(z.object({ nombre: z.string().min(2), rut: z.string().min(8) }))
    .min(1, 'Debe haber al menos un trabajador'),
  observaciones: z.string().optional(),
})

export type DETInput = z.infer<typeof detSchema>
