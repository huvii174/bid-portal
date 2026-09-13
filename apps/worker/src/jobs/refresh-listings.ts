import { and, eq, gte, inArray, isNotNull, lt, or } from 'drizzle-orm'
import { listings, sources, watchlistItems, type Db } from '@bid/db'
import { parseHibidLotHtml } from '../adapters/hibid/parse'
import { createPacer, assertPageBudget, PageBudgetExceededError } from '../rate-limit'

const USER_AGENT =
  process.env.CRAWLER_USER_AGENT ??
  'BidPortal/0.1 (internal antique-auction aggregator; contact: ops@example.com)'

/**
 * Buoc mien phi: phien da qua gio dong ma van dang 'active' thi chac chan
 * da ket thuc. Khong ton mot request nao.
 */
export async function closeExpiredListings(db: Db): Promise<number> {
  const result = await db
    .update(listings)
    .set({ status: 'ended' })
    .where(
      and(
        eq(listings.status, 'active'),
        isNotNull(listings.endsAtUtc),
        lt(listings.endsAtUtc, new Date()),
      ),
    )
  return result.rowCount ?? 0
}

/**
 * Buoc co mang: chi lam moi nhung listing that su dang duoc theo doi, hoac vua
 * ket thuc trong 48h (de lay gia chot). Gioi han cung de khong nuot ngan sach.
 */
export async function refreshWatchedListings(db: Db, maxItems = 25): Promise<number> {
  const [hibid] = await db.select().from(sources).where(eq(sources.id, 'hibid')).limit(1)
  if (!hibid?.enabled) return 0

  const twoDaysAgo = new Date(Date.now() - 48 * 3600_000)

  const rows = await db
    .selectDistinct({
      id: listings.id,
      sourceListingId: listings.sourceListingId,
      url: listings.url,
    })
    .from(listings)
    .innerJoin(watchlistItems, eq(watchlistItems.listingId, listings.id))
    .where(
      and(
        eq(listings.sourceId, 'hibid'),
        or(
          inArray(listings.status, ['active', 'stale']),
          and(eq(listings.status, 'ended'), gte(listings.endsAtUtc, twoDaysAgo)),
        ),
      ),
    )
    .limit(maxItems)

  if (rows.length === 0) return 0

  try {
    await assertPageBudget(db, rows.length)
  } catch (err) {
    if (err instanceof PageBudgetExceededError) {
      console.warn(`[refresh] bo qua: ${err.message}`)
      return 0
    }
    throw err
  }

  const pace = createPacer(hibid.minRequestIntervalMs)
  let updated = 0

  for (const row of rows) {
    await pace()
    try {
      const res = await fetch(row.url, {
        headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) continue

      const lot = parseHibidLotHtml(await res.text(), row.sourceListingId)
      if (!lot) continue

      await db
        .update(listings)
        .set({
          priceKind: lot.priceKind,
          priceAmount: lot.priceAmount?.toFixed(2) ?? null,
          rawPriceText: lot.rawPriceText,
          status: lot.status,
          lastSeenAt: new Date(),
          missingStreak: 0,
        })
        .where(eq(listings.id, row.id))
      updated++
    } catch (err) {
      console.warn(`[refresh] ${row.sourceListingId}: ${(err as Error).message}`)
    }
  }

  return updated
}

export async function runRefresh(db: Db): Promise<{ closed: number; refreshed: number }> {
  const closed = await closeExpiredListings(db)
  const refreshed = await refreshWatchedListings(db)
  return { closed, refreshed }
}
