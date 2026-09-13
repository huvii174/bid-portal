import { SignJWT, jwtVerify } from 'jose'
import type { Role } from '@bid/db/schema'

const COOKIE_NAME = 'bid_session'
// Session khong the thu hoi (JWT khong trang thai), nen han ngan de viec ha
// quyen admin -> member hoac cookie bi danh cap khong keo dai hang thang.
const MAX_AGE_SECONDS = 60 * 60 * 12

export interface SessionPayload {
  userId: string
  email: string
  role: Role
}

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET
  if (!value) throw new Error('AUTH_SECRET is not set')
  // Placeholder trong .env.example la chuoi hop le, nen neu khong chan o day
  // thi mot lan `cp .env.example .env` roi quen sua la bat ky ai doc duoc
  // repo cung tu ky duoc token {role:'admin'}.
  if (value.length < 32 || value.startsWith('change-me')) {
    throw new Error('AUTH_SECRET qua yeu hoac con la placeholder — sinh lai: openssl rand -base64 32')
  }
  return new TextEncoder().encode(value)
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret())
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] })
    if (!payload.sub || typeof payload.email !== 'string' || typeof payload.role !== 'string') {
      return null
    }
    return { userId: payload.sub, email: payload.email, role: payload.role as Role }
  } catch {
    return null
  }
}

export const sessionCookie = {
  name: COOKIE_NAME,
  maxAge: MAX_AGE_SECONDS,
  options: {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_SECONDS,
  },
} as const
