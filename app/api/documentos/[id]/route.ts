import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase-admin'
import { registrarAuditoria } from '@/lib/audit'
import { validarTransicion } from '@/lib/workflow'
import { autenticar, getIp } from '../../_lib/auth-middleware'
import type { DocumentEstado, SafeDocument } from '@/types/document'
import type { UserRole } from '@/types/user'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req)
  if ('error' in auth) return auth.error

  const db = getDb()
  const snap = await db.collection('sc_documents').doc(params.id).get()
  if (!snap.exists) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  return NextResponse.json({ id: snap.id, ...snap.data() })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req)
  if ('error' in auth) return auth.error

  const { user } = auth
  const ip = getIp(req)
  const userAgent = req.headers.get('user-agent') ?? ''

  const db = getDb()
  const docRef = db.collection('sc_documents').doc(params.id)
  const snap = await docRef.get()
  if (!snap.exists) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  const antes = snap.data() as SafeDocument
  const body = await req.json()
  const nuevoEstado = body.estado as DocumentEstado

  if (!nuevoEstado) return NextResponse.json({ error: 'Campo estado requerido' }, { status: 400 })

  const resultado = validarTransicion(
    antes.estado,
    nuevoEstado,
    user.role as UserRole,
    antes
  )

  if (!resultado.permitida) {
    await registrarAuditoria(
      { userId: user.uid, userEmail: user.email, userRole: user.role, ip, userAgent },
      {
        accion: 'ACCESS_DENIED',
        documentId: params.id,
        documentTipo: antes.tipo,
        metadata: { motivo: resultado.motivo },
      }
    )
    return NextResponse.json({ error: resultado.motivo }, { status: 403 })
  }

  const ahora = new Date().toISOString()
  await docRef.update({ estado: nuevoEstado, estadoAnterior: antes.estado, updatedAt: ahora })

  await registrarAuditoria(
    { userId: user.uid, userEmail: user.email, userRole: user.role, ip, userAgent },
    {
      accion: 'UPDATE',
      documentId: params.id,
      documentTipo: antes.tipo,
      antes: { estado: antes.estado },
      despues: { estado: nuevoEstado },
    }
  )

  return NextResponse.json({ id: params.id, estado: nuevoEstado })
}
