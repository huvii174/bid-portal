import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb, watchlistItems } from '@bid/db'
import { getSession } from '../../../lib/auth'

async function readListingId(req: Request): Promise<string | null> {
  const body = (await req.json().catch(() => ({}))) as { listingId?: string }
  return body.listingId ?? null
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const listingId = await readListingId(req)
  if (!listingId) return NextResponse.json({ error: 'thieu listingId' }, { status: 400 })

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
  if (!listingId) return NextResponse.json({ error: 'thieu listingId' }, { status: 400 })

  await getDb()
    .delete(watchlistItems)
    .where(
      and(eq(watchlistItems.userId, session.userId), eq(watchlistItems.listingId, listingId)),
    )

  return NextResponse.json({ ok: true, watchlisted: false })
}
