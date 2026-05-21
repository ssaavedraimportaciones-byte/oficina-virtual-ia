import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/firebase-admin'
import { registrarAuditoria } from '@/lib/audit'
import { puedeFiremar } from '@/lib/signatures'
import { autenticar, getIp } from '../_lib/auth-middleware'
import type { SafeDocument } from '@/types/document'
import type { UserRole, Habilitacion } from '@/types/user'
import crypto from 'crypto'

const firmaSchema = z.object({
  documentId: z.string().min(1),
  firma_base64: z.string().min(1),
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

  const body = firmaSchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalle: body.error.flatten() }, { status: 400 })
  }

  const { documentId, firma_base64, gps } = body.data

  const db = getDb()
  const docRef = db.collection('sc_documents').doc(documentId)
  const snap = await docRef.get()
  if (!snap.exists) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  const documento = snap.data() as SafeDocument

  if (!['borrador', 'completado'].includes(documento.estado)) {
    return NextResponse.json({ error: 'El documento no acepta firmas en su estado actual' }, { status: 409 })
  }

  const userSnap = await db.collection('sc_users').doc(user.uid).get()
  const userData = userSnap.data()

  const elegibilidad = puedeFiremar(
    documento.tipo,
    user.role as UserRole,
    (userData?.habilitaciones ?? []) as Habilitacion[],
    user.uid,
    documento.participantes,
    documento.firmasCompletadas
  )

  if (!elegibilidad.permitida) {
    await registrarAuditoria(
      { userId: user.uid, userEmail: user.email, userRole: user.role, ip, userAgent },
      { accion: 'ACCESS_DENIED', documentId, documentTipo: documento.tipo, metadata: { motivo: elegibilidad.motivo } }
    )
    return NextResponse.json({ error: elegibilidad.motivo }, { status: 403 })
  }

  const hash_documento = crypto
    .createHash('sha256')
    .update(JSON.stringify(documento.campos))
    .digest('hex')

  const ahora = new Date().toISOString()
  const firmaData = {
    documentId,
    userId: user.uid,
    userName: userData?.nombre ?? user.email,
    userRut: userData?.rut ?? '',
    userRole: user.role,
    firma_base64,
    hash_documento,
    firmadoAt: ahora,
    ip,
    userAgent,
    gps: gps ?? null,
  }

  const firmaRef = await db.collection('sc_signatures').add(firmaData)

  const nuevasFirmasCompletadas = [...documento.firmasCompletadas, user.uid]
  await docRef.update({
    firmasCompletadas: nuevasFirmasCompletadas,
    estado: 'completado',
    updatedAt: ahora,
  })

  await registrarAuditoria(
    { userId: user.uid, userEmail: user.email, userRole: user.role, ip, userAgent, gps: gps ?? null },
    { accion: 'SIGN', documentId, documentTipo: documento.tipo, despues: { firmaId: firmaRef.id } }
  )

  return NextResponse.json({ firmaId: firmaRef.id }, { status: 201 })
}
