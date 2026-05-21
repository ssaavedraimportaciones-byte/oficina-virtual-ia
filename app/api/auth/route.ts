import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/firebase-admin'
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '@/lib/auth'
import { registrarAuditoria } from '@/lib/audit'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nombre: z.string().min(2),
  rut: z.string().min(8),
  cargo: z.string().min(2),
  empresa: z.string().min(2),
  faena: z.string().min(2),
})

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconocida'
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  const ip = getIp(req)
  const userAgent = req.headers.get('user-agent') ?? ''

  if (action === 'login') {
    const body = loginSchema.safeParse(await req.json())
    if (!body.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

    const db = getDb()
    const snap = await db.collection('sc_users').where('email', '==', body.data.email).limit(1).get()
    if (snap.empty) return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })

    const doc = snap.docs[0]
    const user = doc.data()
    if (!user.activo) return NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 })

    const ok = await verifyPassword(body.data.password, user.passwordHash)
    if (!ok) {
      await registrarAuditoria(
        { userId: doc.id, userEmail: user.email, userRole: user.role, ip, userAgent },
        { accion: 'ACCESS_DENIED', metadata: { motivo: 'password_incorrecto' } }
      )
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    const access = await signAccessToken({ uid: doc.id, email: user.email, role: user.role, faena: user.faena })
    const refresh = await signRefreshToken(doc.id)

    await registrarAuditoria(
      { userId: doc.id, userEmail: user.email, userRole: user.role, ip, userAgent },
      { accion: 'LOGIN' }
    )

    return NextResponse.json({ access, refresh })
  }

  if (action === 'register') {
    const body = registerSchema.safeParse(await req.json())
    if (!body.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalle: body.error.flatten() }, { status: 400 })
    }

    const db = getDb()
    const existe = await db.collection('sc_users').where('email', '==', body.data.email).limit(1).get()
    if (!existe.empty) return NextResponse.json({ error: 'Email ya registrado' }, { status: 409 })

    const passwordHash = await hashPassword(body.data.password)
    const ahora = new Date().toISOString()

    const ref = await db.collection('sc_users').add({
      ...body.data,
      passwordHash,
      role: 'trabajador',
      habilitaciones: [],
      activo: true,
      createdAt: ahora,
      updatedAt: ahora,
    })

    const access = await signAccessToken({ uid: ref.id, email: body.data.email, role: 'trabajador', faena: body.data.faena })
    const refresh = await signRefreshToken(ref.id)

    await registrarAuditoria(
      { userId: ref.id, userEmail: body.data.email, userRole: 'trabajador', ip, userAgent },
      { accion: 'CREATE', metadata: { recurso: 'usuario', nombre: body.data.nombre } }
    )

    return NextResponse.json({ access, refresh }, { status: 201 })
  }

  if (action === 'refresh') {
    const body = await req.json()
    if (!body.refresh) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
    try {
      const db = getDb()
      const { uid } = await verifyRefreshToken(body.refresh)
      const snap = await db.collection('sc_users').doc(uid).get()
      if (!snap.exists) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
      const user = snap.data()!
      if (!user.activo) return NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 })
      const access = await signAccessToken({ uid, email: user.email, role: user.role, faena: user.faena })
      return NextResponse.json({ access })
    } catch {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
  }

  return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
}
