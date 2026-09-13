import { NextResponse } from 'next/server'
import { getDb, settings } from '@bid/db'
import { getSession } from '../../../../lib/auth'

/**
 * Co tinh dung API route chu khong phai Server Action: Next dispatch server
 * action tu mot bang toan cuc khong gan voi route, nen quyen phai duoc kiem
 * tra ben trong chinh action va khong the dua vao middleware. Route thuong co
 * cung mo hinh bao ve voi moi endpoint khac trong app, va kiem chung duoc.
 */
const NUMERIC_KEYS = ['daily_page_budget', 'pages_per_search', 'keyword_cache_ttl_hours'] as const

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const form = await req.formData()
  const db = getDb()
  const rejected: string[] = []

  const timezone = String(form.get('display_timezone') ?? '').trim()
  if (timezone) {
    // Mui gio sai lam toLocaleString nem RangeError, dap ca /search lan
    // /watchlist cho moi nguoi — chan ngay tai cho nhap.
    if (isValidTimezone(timezone)) {
      await db
        .insert(settings)
        .values({ key: 'display_timezone', value: timezone })
        .onConflictDoUpdate({ target: settings.key, set: { value: timezone } })
    } else {
      rejected.push('display_timezone')
    }
  }

  for (const key of NUMERIC_KEYS) {
    const value = String(form.get(key) ?? '').trim()
    if (!value) continue
    if (!/^\d+$/.test(value) || Number(value) <= 0) {
      rejected.push(key)
      continue
    }
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
  }

  const url = new URL('/admin/settings', req.url)
  url.searchParams.set(rejected.length > 0 ? 'rejected' : 'saved', rejected.join(',') || '1')
  return NextResponse.redirect(url, 303)
}
