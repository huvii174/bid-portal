import { and, eq, gte, inArray, isNotNull, lt, or } from 'drizzle-orm'
import { listingKeywords, listings, sources, watchlistItems, type Db } from '@bid/db'
import { parseHibidLotHtml } from '../adapters/hibid/parse'
import { createPacer, assertPageBudget, PageBudgetExceededError } from '../rate-limit'
import { finishRun, startRun } from '../pipeline/health'

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
  // Luot fetch cua job nay cung phai tinh vao ngan sach, khong thi "phanh cung"
  // chi chan crawl con refresh van am tham tieu ~100 trang/ngay.
  const runId = await startRun(db, 'hibid', '(lam moi listing)')
  let updated = 0
  let fetched = 0
  let failed = 0

  for (const row of rows) {
    await pace()
    try {
      // Host phai co dinh: URL nay dung tu du lieu crawl ve.
      if (new URL(row.url).hostname !== 'hibid.com') continue

      const res = await fetch(row.url, {
        headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
        signal: AbortSignal.timeout(30_000),
      })
      fetched++
      // Phai tinh la that bai: neu HiBid bat dau tra 403/503 cho crawler —
      // cach refresh chet trong thuc te — thi moi lot deu roi vao nhanh nay.
      // Bo qua im lang se lam gia trong watchlist dong bang ma khong ai hay.
      if (!res.ok) {
        failed++
        continue
      }

      const lot = parseHibidLotHtml(await res.text(), row.sourceListingId)
      if (!lot) {
        failed++
        continue
      }

      // `?? null` cho MOI truong: drizzle bo qua key co gia tri undefined, nen
      // thieu no la gia tri cu con sot lai canh gia moi — vi du rawPriceText
      // "Current bid 500" nam canh priceAmount da null.
      await db
        .update(listings)
        .set({
          priceKind: lot.priceKind,
          priceAmount: lot.priceAmount?.toFixed(2) ?? null,
          priceAmountHigh: lot.priceAmountHigh?.toFixed(2) ?? null,
          rawPriceText: lot.rawPriceText ?? null,
          estimateLow: lot.estimateLow?.toFixed(2) ?? null,
          estimateHigh: lot.estimateHigh?.toFixed(2) ?? null,
          rawEstimateText: lot.rawEstimateText ?? null,
          status: lot.status,
          lastSeenAt: new Date(),
        })
        .where(eq(listings.id, row.id))

      // Da xac nhan tan mat lot nay con song, nen phai xoa streak vang mat.
      // Neu khong, mon vua duoc dua ve 'active' se bi crawl ke tiep danh dau
      // stale lai ngay — nhap nhay vinh vien tren watchlist.
      await db
        .update(listingKeywords)
        .set({ missingStreak: 0 })
        .where(eq(listingKeywords.listingId, row.id))

      updated++
    } catch (err) {
      failed++
      console.warn(`[refresh] ${row.sourceListingId}: ${(err as Error).message}`)
    }
  }

  // Hardcode 'ok' se lam mot lan refresh hong hoan toan khong canh bao ai.
  await finishRun(db, runId, 'hibid', '(lam moi listing)', {
    status: failed === rows.length ? 'error' : 'ok',
    itemsFound: updated,
    pagesFetched: fetched,
    errorText: failed > 0 ? `${failed}/${rows.length} lot lam moi that bai` : undefined,
  })

  return updated
}

export async function runRefresh(db: Db): Promise<{ closed: number; refreshed: number }> {
  const closed = await closeExpiredListings(db)
  const refreshed = await refreshWatchedListings(db)
  return { closed, refreshed }
}
