import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { JWT_SECRET } from '@/lib/env'
import type { TokenPayload } from '@/types/user'

const secret = () => new TextEncoder().encode(JWT_SECRET)

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12)
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash)

export async function signAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(await secret())
}

export async function signRefreshToken(uid: string): Promise<string> {
  return new SignJWT({ uid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(await secret())
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, await secret())
  return payload as unknown as TokenPayload
}

export async function verifyRefreshToken(token: string): Promise<{ uid: string }> {
  const { payload } = await jwtVerify(token, await secret())
  return payload as { uid: string }
}
