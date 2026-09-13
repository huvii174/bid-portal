import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { getDb, users } from '@bid/db'
import { signSession, sessionCookie } from '../../../../lib/session'

/**
 * `next` den tu URL nen phai la duong dan noi bo.
 *
 * PHAI parse roi so origin, KHONG duoc khop mau tren chuoi tho: new URL() xoa
 * tab/LF/CR TRUOC khi parse, nen "/<tab>/evil.com" lot qua moi regex kiem tra
 * ky tu dau nhung van giai ra https://evil.com. startsWith('/') cung khong du
 * ("//evil.com", "/\evil.com"). Chi co origin thuc sau khi parse moi dang tin.
 */
function safeNext(raw: string, base: string): string {
  if (!raw.trim()) return '/search'
  try {
    const target = new URL(raw, base)
    if (target.origin !== new URL(base).origin) return '/search'
    // Chuoi rong giai ra chinh route nay (chi nhan POST), nen mot redirect GET
    // vao day se hong. Moi duong dan /api/ deu khong phai cho de dap xuong.
    if (target.pathname.startsWith('/api/')) return '/search'
    return target.pathname + target.search
  } catch {
    return '/search'
  }
}

/** Hash gia de so sanh khi email khong ton tai — giu thoi gian phan hoi deu nhau. */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.4nQSA3wS8bF0BrFPYHqZ0O0e9fPqM7S'

export async function POST(req: Request) {
  const form = await req.formData()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  const next = safeNext(String(form.get('next') ?? '/search'), req.url)

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
