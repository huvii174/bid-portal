import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { getDb, users } from '@bid/db'
import { signSession, sessionCookie } from '../../../../lib/session'

/**
 * `next` den tu URL nen phai la duong dan noi bo. Chi kiem tra startsWith('/')
 * la KHONG du: "//evil.com" va "/\evil.com" deu bat dau bang '/' nhung
 * new URL() giai ra host ngoai — thanh open redirect de phishing.
 */
function safeNext(raw: string): string {
  return /^\/(?![\\/])/.test(raw) ? raw : '/search'
}

/** Hash gia de so sanh khi email khong ton tai — giu thoi gian phan hoi deu nhau. */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.4nQSA3wS8bF0BrFPYHqZ0O0e9fPqM7S'

export async function POST(req: Request) {
  const form = await req.formData()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  const next = safeNext(String(form.get('next') ?? '/search'))

  const fail = () =>
    NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, req.url), 303)

  if (!email || !password) return fail()

  const db = getDb()
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

  // Luon chay bcrypt du email co ton tai hay khong, neu khong thoi gian phan
  // hoi se to cao email nao la tai khoan that.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !ok) return fail()

  const token = await signSession({ userId: user.id, email: user.email, role: user.role })
  const res = NextResponse.redirect(new URL(next, req.url), 303)
  res.cookies.set(sessionCookie.name, token, sessionCookie.options)
  return res
}
