import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/firebase-admin'
import { registrarAuditoria } from '@/lib/audit'
import { puedeAprobarNivel } from '@/lib/roles'
import { DOCUMENT_TYPES } from '@/lib/document-types'
import { autenticar, getIp } from '../_lib/auth-middleware'
import type { SafeDocument } from '@/types/document'
import type { UserRole } from '@/types/user'

const aprobacionSchema = z.object({
  documentId: z.string().min(1),
  decision: z.enum(['aprobado', 'rechazado']),
  comentario: z.string().optional().default(''),
  gps: z.object({
    lat: z.number(),
    lng: z.number(),
    precision: z.number(),
    status: z.enum(['disponible', 'denegado', 'no_soportado', 'timeout']),
  }).nullable().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await autenticar(req)
  if ('error' in auth) return auth.error

  const { user } = auth
  const ip = getIp(req)
  const userAgent = req.headers.get('user-agent') ?? ''

  const body = aprobacionSchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalle: body.error.flatten() }, { status: 400 })
  }

  const { documentId, decision, comentario, gps } = body.data

  const db = getDb()

  // Transacción atómica: evita race condition si dos aprobadores actúan al mismo tiempo
  const resultado = await db.runTransaction(async (tx) => {
    const docRef = db.collection('sc_documents').doc(documentId)
    const snap = await tx.get(docRef)
    if (!snap.exists) return { error: 'Documento no encontrado', status: 404 }

    const documento = snap.data() as SafeDocument
    if (documento.estado !== 'pendiente_aprobacion') {
      return { error: 'El documento no está en estado de aprobación', status: 409 }
    }

    const config = DOCUMENT_TYPES[documento.tipo]
    const aprobacionesExistentes = await db
      .collection('sc_approvals')
      .where('documentId', '==', documentId)
      .get()

    const nivelActual = (aprobacionesExistentes.size + 1) as 1 | 2 | 3

    if (!puedeAprobarNivel(user.role as UserRole, nivelActual)) {
      return { error: `Tu rol no puede aprobar en el nivel ${nivelActual}`, status: 403 }
    }

    const yaAprobó = aprobacionesExistentes.docs.some(d => d.data().aprobadorId === user.uid)
    if (yaAprobó) {
      return { error: 'Ya registraste una aprobación en este documento', status: 409 }
    }

    const ahora = new Date().toISOString()
    const aprobacionData = {
      documentId,
      nivel: nivelActual,
      aprobadorId: user.uid,
      aprobadorNombre: user.email,
      aprobadorRole: user.role,
      decision,
      comentario,
      timestamp: ahora,
      ip,
      gps: gps ?? null,
    }

    const aprobRef = db.collection('sc_approvals').doc()
    tx.set(aprobRef, aprobacionData)

    const nuevasAprobaciones = documento.aprobacionesCompletadas + 1
    const aprobacionCompleta = decision === 'aprobado' && nuevasAprobaciones >= config.aprobacionesRequeridas
    const nuevoEstado = decision === 'rechazado'
      ? 'rechazado'
      : aprobacionCompleta
        ? 'aprobado'
        : 'pendiente_aprobacion'

    tx.update(docRef, {
      aprobacionesCompletadas: nuevasAprobaciones,
      estado: nuevoEstado,
      estadoAnterior: documento.estado,
      updatedAt: ahora,
    })

    return { aprobacionId: aprobRef.id, nuevoEstado }
  })

  if ('error' in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status })
  }

  await registrarAuditoria(
    { userId: user.uid, userEmail: user.email, userRole: user.role, ip, userAgent, gps: gps ?? null },
    {
      accion: decision === 'aprobado' ? 'APPROVE' : 'REJECT',
      documentId,
      despues: { decision, nuevoEstado: resultado.nuevoEstado },
    }
  )

  return NextResponse.json(resultado, { status: 201 })
}
