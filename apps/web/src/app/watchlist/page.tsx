import { desc, eq } from 'drizzle-orm'
import {
  auctionHouses,
  auctions,
  getDb,
  listings,
  watchlistItems,
} from '@bid/db'
import { requireSession } from '../../lib/auth'
import { getDisplayTimezone } from '../../lib/settings'
import { getFxContext } from '../../lib/fx'
import { ListingCard, type ResultRow } from '../../components/ListingCard'

export default async function WatchlistPage() {
  const session = await requireSession()
  const timezone = await getDisplayTimezone()
  const fx = await getFxContext(session.userId)

  const rows = await getDb()
    .select({
      id: listings.id,
      sourceId: listings.sourceId,
      url: listings.url,
      title: listings.title,
      thumbUrl: listings.thumbUrl,
      lotNo: listings.lotNo,
      currency: listings.currency,
      priceKind: listings.priceKind,
      priceAmount: listings.priceAmount,
      priceAmountHigh: listings.priceAmountHigh,
      estimateLow: listings.estimateLow,
      estimateHigh: listings.estimateHigh,
      rawEstimateText: listings.rawEstimateText,
      endsAtUtc: listings.endsAtUtc,
      endTimeIsApproximate: listings.endTimeIsApproximate,
      status: listings.status,
      houseName: auctionHouses.name,
      addedAt: watchlistItems.createdAt,
    })
    .from(watchlistItems)
    .innerJoin(listings, eq(listings.id, watchlistItems.listingId))
    .leftJoin(auctions, eq(auctions.id, listings.auctionId))
    .leftJoin(auctionHouses, eq(auctionHouses.id, auctions.auctionHouseId))
    .where(eq(watchlistItems.userId, session.userId))
    .orderBy(desc(watchlistItems.createdAt))

  const items: ResultRow[] = rows.map((r) => ({
    ...r,
    endsAtUtc: r.endsAtUtc ? r.endsAtUtc.toISOString() : null,
    watchlisted: true,
  })) as unknown as ResultRow[]

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Hàng quan tâm</h1>

      {items.length === 0 ? (
        <p className="muted">
          Chưa lưu món nào. Vào <a href="/search">Tìm hàng</a> và bấm ☆ trên món bạn quan tâm.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: 14,
          }}
        >
          {items.map((row) => (
            <ListingCard key={row.id} row={row} timezone={timezone} fx={fx} />
          ))}
        </div>
      )}
    </>
  )
}
