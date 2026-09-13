import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb, normalizeCurrency, users } from '@bid/db'
import { getSession } from '../../../../lib/auth'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const form = await req.formData()
  const raw = String(form.get('currency') ?? '').trim()
  // Chuoi rong = quay ve "giu nguyen tien goc, khong quy doi".
  const currency = raw ? normalizeCurrency(raw) : null
  if (raw && !currency) {
    return NextResponse.json({ error: 'ma tien te khong hop le' }, { status: 400 })
  }

  await getDb().update(users).set({ displayCurrency: currency }).where(eq(users.id, session.userId))

  // NextResponse.redirect can URL tuyet doi. Referer chi duoc dung khi cung
  // goc, neu khong thi quay ve trang tim kiem.
  const back = req.headers.get('referer')
  const sameOrigin = (() => {
    if (!back) return null
    try {
      return new URL(back).origin === new URL(req.url).origin ? back : null
    } catch {
      return null
    }
  })()

  return NextResponse.redirect(sameOrigin ?? new URL('/search', req.url), 303)
}
