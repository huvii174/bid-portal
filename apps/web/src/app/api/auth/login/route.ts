import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { getDb, users } from '@bid/db'
import { signSession, sessionCookie } from '../../../../lib/session'

export async function POST(req: Request) {
  const form = await req.formData()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  const next = String(form.get('next') ?? '/search')

  const fail = () =>
    NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, req.url), 303)

  if (!email || !password) return fail()

  const db = getDb()
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) return fail()

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return fail()

  const token = await signSession({ userId: user.id, email: user.email, role: user.role })
  const res = NextResponse.redirect(new URL(next.startsWith('/') ? next : '/search', req.url), 303)
  res.cookies.set(sessionCookie.name, token, sessionCookie.options)
  return res
}
