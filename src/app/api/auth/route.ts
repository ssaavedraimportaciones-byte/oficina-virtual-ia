import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db/client'
import { verifyRefreshToken, signAccessToken } from '@/lib/auth'
import { loginUser, registerUser } from '@/modules/auth'
import { log } from '@/modules/audit'
import { loginSchema, registerSchema } from '@/schemas/auth'
import { getIp } from '@/app/api/_lib/auth-middleware'
import {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  getRateLimitKey,
  LOGIN_RATE_LIMIT,
  REGISTER_RATE_LIMIT,
} from '@/lib/rate-limit'
import type { TokenPayload } from '@/types/user'

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
}

// Generic message for all auth failures — never reveal which field was wrong
const AUTH_ERROR = 'Credenciales inválidas o demasiados intentos. Intente más tarde.'

async function setCookies(access: string, refresh: string) {
  const jar = await cookies()
  jar.set('access_token', access, { ...COOKIE_OPTS, maxAge: 60 * 15 })
  jar.set('refresh_token', refresh, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 30 })
}

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action')
  const ip = getIp(req)
  const ua = req.headers.get('user-agent') ?? ''

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if (action === 'login') {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })

    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos de login inválidos' }, { status: 400 })
    }

    const key = getRateLimitKey(ip, 'auth:login')
    const rl = await checkRateLimit(key, LOGIN_RATE_LIMIT)

    if (rl.blocked) {
      // Server-side security log — no userId available pre-login
      // TODO: replace with persistent SecurityLog when available
      console.warn('[security] rate-limit blocked', {
        scope: 'auth:login',
        ip,
        userAgent: ua,
        attempts: rl.attempts,
        resetAt: new Date(rl.resetAt).toISOString(),
      })
      return NextResponse.json({ error: AUTH_ERROR }, { status: 429 })
    }

    try {
      const { access, refresh, user } = await loginUser(parsed.data.email, parsed.data.password)
      await resetRateLimit(key)

      // MFA required for privileged roles
      const MFA_REQUIRED_ROLES = ['SYSTEM_ADMIN', 'CONTRACT_ADMIN'] as const
      const requiresMfa = (MFA_REQUIRED_ROLES as readonly string[]).includes(user.role)
      if (requiresMfa) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { mfaEnabled: true, mfaSecret: true },
        })
        if (dbUser?.mfaEnabled && dbUser.mfaSecret) {
          // Issue short-lived MFA challenge — no session cookies yet
          await log({ userId: user.id, ip, userAgent: ua }, 'LOGIN_MFA_REQUIRED', {
            metadata: { role: user.role },
          })
          return NextResponse.json({ mfaRequired: true, userId: user.id }, { status: 200 })
        }
      }

      await setCookies(access, refresh)
      await log({ userId: user.id, ip, userAgent: ua }, 'LOGIN', {
        metadata: { email: user.email, role: user.role },
      })
      return NextResponse.json({ user })
    } catch {
      // Intentional: don't expose why credentials failed
      const after = await recordFailedAttempt(key, LOGIN_RATE_LIMIT)
      if (after.blocked) {
        console.warn('[security] rate-limit triggered', {
          scope: 'auth:login',
          ip,
          userAgent: ua,
          attempts: after.attempts,
        })
      }
      return NextResponse.json({ error: AUTH_ERROR }, { status: 401 })
    }
  }

  // ── LOGOUT ─────────────────────────────────────────────────────────────────
  if (action === 'logout') {
    try {
      const jar = await cookies()
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
    } catch {
      return NextResponse.json({ error: 'Error al cerrar sesión' }, { status: 500 })
    }
  }

  // ── REFRESH ────────────────────────────────────────────────────────────────
  if (action === 'refresh') {
    try {
      const jar = await cookies()
      const refreshToken = jar.get('refresh_token')?.value
      if (!refreshToken) {
        return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 })
      }
      const { uid } = await verifyRefreshToken(refreshToken)
      const stored = await prisma.refreshToken.findFirst({
        where: { token: refreshToken, userId: uid, expiresAt: { gt: new Date() } },
      })
      if (!stored) {
        return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 })
      }
      const user = await prisma.user.findUnique({
        where: { id: uid },
        select: { id: true, email: true, name: true, role: true, companyId: true, isActive: true },
      })
      if (!user || !user.isActive) {
        return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 })
      }
      const payload: TokenPayload = {
        uid: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
      }
      const newAccess = await signAccessToken(payload)
      const jar2 = await cookies()
      jar2.set('access_token', newAccess, { ...COOKIE_OPTS, maxAge: 60 * 15 })
      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 })
    }
  }

  // ── REGISTER ───────────────────────────────────────────────────────────────
  if (action === 'register') {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })

    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const key = getRateLimitKey(ip, 'auth:register')
    const rl = await checkRateLimit(key, REGISTER_RATE_LIMIT)
    if (rl.blocked) {
      console.warn('[security] rate-limit blocked', {
        scope: 'auth:register',
        ip,
        userAgent: ua,
        attempts: rl.attempts,
      })
      return NextResponse.json({ error: 'Demasiados intentos de registro. Intente más tarde.' }, { status: 429 })
    }

    try {
      const { access, refresh, user } = await registerUser(parsed.data)
      await resetRateLimit(key)
      await setCookies(access, refresh)
      await log({ userId: user.id, ip, userAgent: ua }, 'CREATE', {
        metadata: { email: user.email, action: 'REGISTER' },
      })
      return NextResponse.json({ user }, { status: 201 })
    } catch {
      await recordFailedAttempt(key, REGISTER_RATE_LIMIT)
      return NextResponse.json({ error: 'No se pudo completar el registro. Intente más tarde.' }, { status: 400 })
    }
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}
