import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb, watchlistItems } from '@bid/db'
import { getSession } from '../../../lib/auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function readListingId(req: Request): Promise<string | null> {
  const body = (await req.json().catch(() => ({}))) as { listingId?: string }
  const id = body.listingId
  // Chuoi khong phai uuid se lam Postgres nem loi cast -> 500.
  return typeof id === 'string' && UUID_RE.test(id) ? id : null
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const listingId = await readListingId(req)
  if (!listingId) return NextResponse.json({ error: 'listingId is required' }, { status: 400 })

  await getDb()
    .insert(watchlistItems)
    .values({ userId: session.userId, listingId })
    .onConflictDoNothing({ target: [watchlistItems.userId, watchlistItems.listingId] })

  return NextResponse.json({ ok: true, watchlisted: true })
}

export async function DELETE(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const listingId = await readListingId(req)
  if (!listingId) return NextResponse.json({ error: 'listingId is required' }, { status: 400 })

  await getDb()
    .delete(watchlistItems)
    .where(
      and(eq(watchlistItems.userId, session.userId), eq(watchlistItems.listingId, listingId)),
    )

  return NextResponse.json({ ok: true, watchlisted: false })
}
