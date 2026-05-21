import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/firebase-admin'
import { registrarAuditoria } from '@/lib/audit'
import { validarCamposDocumento } from '@/lib/validators'
import { DOCUMENT_TYPES } from '@/lib/document-types'
import { puedeCrearDocumento } from '@/lib/roles'
import { autenticar, getIp } from '../_lib/auth-middleware'
import type { DocumentTipo } from '@/types/document'

const crearSchema = z.object({
  tipo: z.enum(['CHARLA', 'DET', 'ART', 'AST', 'PERMISO', 'LOTO', 'ALTURA', 'IZAJE', 'ESPACIO_CONFINADO']),
  faena: z.string().min(1),
  area: z.string().min(1),
  fecha_trabajo: z.string().min(1),
  campos: z.record(z.unknown()),
  participantes: z.array(z.string()).default([]),
})

export async function GET(req: NextRequest) {
  const auth = await autenticar(req)
  if ('error' in auth) return auth.error

  const db = getDb()
  const url = new URL(req.url)
  const faena = url.searchParams.get('faena')
  const tipo = url.searchParams.get('tipo')
  const estado = url.searchParams.get('estado')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100)

  let query = db.collection('sc_documents').orderBy('createdAt', 'desc').limit(limit)
  if (faena) query = query.where('faena', '==', faena) as typeof query
  if (tipo) query = query.where('tipo', '==', tipo) as typeof query
  if (estado) query = query.where('estado', '==', estado) as typeof query

  const snap = await query.get()
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

  return NextResponse.json({ documentos: docs, total: docs.length })
}

export async function POST(req: NextRequest) {
  const auth = await autenticar(req)
  if ('error' in auth) return auth.error

  const { user } = auth
  const ip = getIp(req)
  const userAgent = req.headers.get('user-agent') ?? ''

  if (!puedeCrearDocumento(user.role as never)) {
    await registrarAuditoria(
      { userId: user.uid, userEmail: user.email, userRole: user.role, ip, userAgent },
      { accion: 'ACCESS_DENIED', metadata: { motivo: 'rol_sin_permiso_crear' } }
    )
    return NextResponse.json({ error: 'Sin permiso para crear documentos' }, { status: 403 })
  }

  const body = crearSchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalle: body.error.flatten() }, { status: 400 })
  }

  const { tipo, faena, area, fecha_trabajo, campos, participantes } = body.data
  const config = DOCUMENT_TYPES[tipo as DocumentTipo]

  const validacion = validarCamposDocumento(tipo as DocumentTipo, campos)
  if (!validacion.valido) {
    return NextResponse.json({ error: 'Campos incompletos', errores: validacion.errores }, { status: 422 })
  }

  const db = getDb()
  const ahora = new Date().toISOString()

  const docData = {
    tipo,
    version: 1,
    estado: 'borrador',
    estadoAnterior: null,
    faena,
    area,
    fecha_trabajo,
    createdBy: user.uid,
    createdByNombre: user.email,
    campos,
    participantes,
    firmasRequeridas: participantes,
    firmasCompletadas: [],
    aprobacionesRequeridas: config.aprobacionesRequeridas,
    aprobacionesCompletadas: 0,
    timbreId: null,
    createdAt: ahora,
    updatedAt: ahora,
  }

  const ref = await db.collection('sc_documents').add(docData)

  await registrarAuditoria(
    { userId: user.uid, userEmail: user.email, userRole: user.role, ip, userAgent },
    { accion: 'CREATE', documentId: ref.id, documentTipo: tipo, despues: docData }
  )

  return NextResponse.json({ id: ref.id, ...docData }, { status: 201 })
}
