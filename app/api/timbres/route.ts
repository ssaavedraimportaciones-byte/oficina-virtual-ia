import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/firebase-admin'
import { registrarAuditoria } from '@/lib/audit'
import { generarHashDocumento, generarNumeroTimbre } from '@/lib/stamps'
import { autenticar, getIp } from '../_lib/auth-middleware'
import type { SafeDocument, Signature, Approval } from '@/types/document'
import type { UserRole } from '@/types/user'

const timbreSchema = z.object({
  documentId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const auth = await autenticar(req)
  if ('error' in auth) return auth.error

  const { user } = auth
  const ip = getIp(req)
  const userAgent = req.headers.get('user-agent') ?? ''

  if (!['prevencionista', 'admin'].includes(user.role)) {
    return NextResponse.json({ error: 'Solo prevencionista o admin puede timbrar' }, { status: 403 })
  }

  const body = timbreSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: 'documentId requerido' }, { status: 400 })

  const { documentId } = body.data
  const db = getDb()

  const [docSnap, firmasSnap, aprob·Snap, contadorSnap] = await Promise.all([
    db.collection('sc_documents').doc(documentId).get(),
    db.collection('sc_signatures').where('documentId', '==', documentId).get(),
    db.collection('sc_approvals').where('documentId', '==', documentId).get(),
    db.collection('sc_stamps').count().get(),
  ])

  if (!docSnap.exists) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  const documento = docSnap.data() as SafeDocument
  if (documento.estado !== 'aprobado') {
    return NextResponse.json({ error: 'Solo se pueden timbrar documentos aprobados' }, { status: 409 })
  }
  if (documento.timbreId) {
    return NextResponse.json({ error: 'El documento ya tiene timbre' }, { status: 409 })
  }

  const firmas = firmasSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Signature)
  const aprobaciones = aprob·Snap.docs.map(d => ({ id: d.id, ...d.data() }) as Approval)
  const contador = (contadorSnap.data().count as number) + 1

  const hash_final = generarHashDocumento(documento, firmas, aprobaciones)
  const numero_timbre = generarNumeroTimbre(contador)
  const ahora = new Date().toISOString()

  const timbreData = {
    documentId,
    numero_timbre,
    hash_final,
    generadoPor: user.uid,
    timestamp: ahora,
    ip,
  }

  const timbreRef = await db.collection('sc_stamps').add(timbreData)
  await db.collection('sc_documents').doc(documentId).update({
    timbreId: timbreRef.id,
    estado: 'timbrado',
    estadoAnterior: 'aprobado',
    updatedAt: ahora,
  })

  await registrarAuditoria(
    { userId: user.uid, userEmail: user.email, userRole: user.role as UserRole, ip, userAgent },
    { accion: 'STAMP', documentId, documentTipo: documento.tipo, despues: { numero_timbre, hash_final } }
  )

  return NextResponse.json({ timbreId: timbreRef.id, numero_timbre, hash_final }, { status: 201 })
}
