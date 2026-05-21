import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db/client'
import { verifyRefreshToken, signAccessToken } from '@/lib/auth'
import { loginUser, registerUser } from '@/modules/auth'
import { log } from '@/modules/audit'
import { loginSchema, registerSchema } from '@/schemas/auth'
import { getIp } from '@/app/api/_lib/auth-middleware'
import type { TokenPayload } from '@/types/user'

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
}

function setCookies(access: string, refresh: string) {
  const jar = cookies()
  jar.set('access_token', access, { ...COOKIE_OPTS, maxAge: 60 * 15 })
  jar.set('refresh_token', refresh, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 30 })
}

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action')
  const ip = getIp(req)
  const ua = req.headers.get('user-agent') ?? ''

  try {
    if (action === 'login') {
      const body = await req.json()
      const parsed = loginSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
      }
      const { access, refresh, user } = await loginUser(parsed.data.email, parsed.data.password)
      setCookies(access, refresh)
      await log({ userId: user.id, ip, userAgent: ua }, 'LOGIN', {
        metadata: { email: user.email, role: user.role },
      })
      return NextResponse.json({ user })
    }

    if (action === 'logout') {
      const jar = cookies()
      const refreshToken = jar.get('refresh_token')?.value
      if (refreshToken) {
        const uid = req.headers.get('x-user-id')
        await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
        if (uid) {
          await log({ userId: uid, ip, userAgent: ua }, 'LOGOUT')
        }
      }
      jar.delete('access_token')
      jar.delete('refresh_token')
      return NextResponse.json({ ok: true })
    }

    if (action === 'refresh') {
      const jar = cookies()
      const refreshToken = jar.get('refresh_token')?.value
      if (!refreshToken) {
        return NextResponse.json({ error: 'No refresh token' }, { status: 401 })
      }
      const { uid } = await verifyRefreshToken(refreshToken)
      const stored = await prisma.refreshToken.findFirst({
        where: { token: refreshToken, userId: uid, expiresAt: { gt: new Date() } },
      })
      if (!stored) {
        return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 })
      }
      const user = await prisma.user.findUnique({
        where: { id: uid },
        select: { id: true, email: true, name: true, role: true, companyId: true, isActive: true },
      })
      if (!user || !user.isActive) {
        return NextResponse.json({ error: 'User not found' }, { status: 401 })
      }
      const payload: TokenPayload = {
        uid: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
      }
      const newAccess = await signAccessToken(payload)
      const jar2 = cookies()
      jar2.set('access_token', newAccess, { ...COOKIE_OPTS, maxAge: 60 * 15 })
      return NextResponse.json({ ok: true })
    }

    if (action === 'register') {
      const body = await req.json()
      const parsed = registerSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
      }
      const { access, refresh, user } = await registerUser(parsed.data)
      setCookies(access, refresh)
      await log({ userId: user.id, ip, userAgent: ua }, 'CREATE', {
        metadata: { email: user.email, action: 'REGISTER' },
      })
      return NextResponse.json({ user }, { status: 201 })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
