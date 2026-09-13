import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb, users } from '@bid/db'
import { getSession } from '../../../../lib/auth'
import { isLocale } from '../../../../i18n'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const form = await req.formData()
  const value = String(form.get('locale') ?? '').trim()
  if (!isLocale(value)) {
    return NextResponse.json({ error: 'invalid locale' }, { status: 400 })
  }

  await getDb().update(users).set({ locale: value }).where(eq(users.id, session.userId))

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
