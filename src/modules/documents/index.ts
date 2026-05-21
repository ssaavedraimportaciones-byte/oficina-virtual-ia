import { prisma } from '@/lib/db/client'
import { validarCampos } from '@/lib/validators'
import { APROBACIONES_REQUERIDAS } from '@/lib/constants'
import { puedeCrearDocumento } from '@/lib/permissions'
import type { DocumentTipo, DocumentEstado } from '@/types/document'
import type { UserRole } from '@/types/user'

export async function crearDocumento(params: {
  tipo: DocumentTipo
  faenaId: string
  area: string
  fechaTrabajo: Date
  campos: Record<string, unknown>
  participantesIds: string[]
  creadoPorId: string
  creadoPorRole: UserRole
}) {
  if (!puedeCrearDocumento(params.creadoPorRole)) throw new Error('Sin permiso para crear documentos')

  const validacion = validarCampos(params.tipo, params.campos)
  if (!validacion.valido) throw new Error(`Campos incompletos: ${validacion.errores.join(', ')}`)

  return prisma.document.create({
    data: {
      tipo: params.tipo,
      faenaId: params.faenaId,
      area: params.area,
      fechaTrabajo: params.fechaTrabajo,
      campos: params.campos,
      createdById: params.creadoPorId,
      aprobacionesRequeridas: APROBACIONES_REQUERIDAS[params.tipo],
      participantes: { create: params.participantesIds.map(uid => ({ userId: uid })) },
    },
    include: { participantes: true },
  })
}

export async function listarDocumentos(filtros: {
  faenaId?: string
  tipo?: DocumentTipo
  estado?: DocumentEstado
  limit?: number
}) {
  return prisma.document.findMany({
    where: {
      ...(filtros.faenaId && { faenaId: filtros.faenaId }),
      ...(filtros.tipo && { tipo: filtros.tipo }),
      ...(filtros.estado && { estado: filtros.estado }),
    },
    orderBy: { createdAt: 'desc' },
    take: filtros.limit ?? 50,
    include: {
      createdBy: { select: { nombre: true } },
      _count: { select: { signatures: true, approvals: true } },
    },
  })
}
