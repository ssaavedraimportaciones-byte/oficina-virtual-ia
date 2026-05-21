import { prisma } from '@/lib/db/client'
import { puedeAprobarNivel } from '@/lib/permissions'
import type { UserRole } from '@/types/user'

export async function registrarAprobacion(params: {
  documentId: string
  aprobadorId: string
  aprobadorRole: UserRole
  decision: 'aprobado' | 'rechazado'
  comentario?: string
  ip: string
  gpsLat?: number
  gpsLng?: number
}) {
  return prisma.$transaction(async (tx) => {
    const doc = await tx.document.findUniqueOrThrow({ where: { id: params.documentId } })
    if (doc.estado !== 'PENDIENTE_APROBACION') throw new Error('Documento no está en aprobación')

    const existentes = await tx.approval.findMany({ where: { documentId: params.documentId } })
    const nivelActual = (existentes.length + 1) as 1 | 2 | 3

    if (!puedeAprobarNivel(params.aprobadorRole, nivelActual))
      throw new Error(`Rol sin permiso para nivel ${nivelActual}`)

    const yaActuó = existentes.some(a => a.aprobadorId === params.aprobadorId)
    if (yaActuó) throw new Error('Ya registraste una decisión en este documento')

    const aprobacion = await tx.approval.create({
      data: {
        documentId: params.documentId,
        nivel: nivelActual,
        aprobadorId: params.aprobadorId,
        decision: params.decision,
        comentario: params.comentario,
        ip: params.ip,
        gpsLat: params.gpsLat,
        gpsLng: params.gpsLng,
      },
    })

    const nuevasAprobaciones = doc.aprobacionesCompletadas + 1
    const aprobacionCompleta = params.decision === 'aprobado' && nuevasAprobaciones >= doc.aprobacionesRequeridas
    const nuevoEstado = params.decision === 'rechazado' ? 'RECHAZADO' : aprobacionCompleta ? 'APROBADO' : 'PENDIENTE_APROBACION'

    await tx.document.update({
      where: { id: params.documentId },
      data: { aprobacionesCompletadas: nuevasAprobaciones, estado: nuevoEstado, estadoAnterior: doc.estado },
    })

    return { aprobacion, nuevoEstado }
  })
}
