import { and, eq, inArray, notInArray, sql } from 'drizzle-orm'
import {
  auctionHouses,
  auctions,
  listingKeywords,
  listings,
  type Db,
} from '@bid/db'
import type { RawAuction, RawListing } from '../adapters/types'

/** numeric cua Postgres nhan string; undefined -> null de khong ghi de bang NaN. */
function money(n: number | undefined): string | null {
  return n === undefined || !Number.isFinite(n) ? null : n.toFixed(2)
}

async function upsertAuction(
  db: Db,
  sourceId: string,
  raw: RawAuction,
): Promise<string | null> {
  let houseId: string | null = null

  if (raw.house) {
    const [house] = await db
      .insert(auctionHouses)
      .values({
        sourceId,
        sourceHouseId: raw.house.sourceHouseId,
        name: raw.house.name,
        city: raw.house.city,
        state: raw.house.state,
      })
      .onConflictDoUpdate({
        target: [auctionHouses.sourceId, auctionHouses.sourceHouseId],
        set: { name: raw.house.name, city: raw.house.city, state: raw.house.state },
      })
      .returning({ id: auctionHouses.id })
    houseId = house?.id ?? null
  }

  const [auction] = await db
    .insert(auctions)
    .values({
      sourceId,
      sourceAuctionId: raw.sourceAuctionId,
      auctionHouseId: houseId,
      title: raw.title,
      format: raw.format,
      currency: raw.currency,
      buyerPremiumRate: raw.buyerPremiumRate?.toString(),
      startsAtUtc: raw.startsAtUtc,
      endsAtUtc: raw.endsAtUtc,
    })
    .onConflictDoUpdate({
      target: [auctions.sourceId, auctions.sourceAuctionId],
      set: {
        auctionHouseId: houseId,
        title: raw.title,
        format: raw.format,
        currency: raw.currency,
        endsAtUtc: raw.endsAtUtc,
      },
    })
    .returning({ id: auctions.id })

  return auction?.id ?? null
}

export interface UpsertResult {
  listingIds: string[]
}

/**
 * Ghi ket qua mot lan crawl. Moi listing gap lai se reset missingStreak — do
 * la can cu de job refresh danh dau stale khi no bien mat nhieu lan lien tiep.
 */
export async function upsertListings(
  db: Db,
  sourceId: string,
  keyword: string,
  raws: RawListing[],
): Promise<UpsertResult> {
  const listingIds: string[] = []

  for (const [index, raw] of raws.entries()) {
    const auctionId = raw.auction ? await upsertAuction(db, sourceId, raw.auction) : null

    const [row] = await db
      .insert(listings)
      .values({
        sourceId,
        sourceListingId: raw.sourceListingId,
        auctionId,
        url: raw.url,
        title: raw.title,
        description: raw.description,
        thumbUrl: raw.thumbUrl,
        sourceCategory: raw.sourceCategory,
        lotNo: raw.lotNo,
        currency: raw.currency,
        priceKind: raw.priceKind,
        priceAmount: money(raw.priceAmount),
        priceAmountHigh: money(raw.priceAmountHigh),
        rawPriceText: raw.rawPriceText,
        estimateLow: money(raw.estimateLow),
        estimateHigh: money(raw.estimateHigh),
        rawEstimateText: raw.rawEstimateText,
        endsAtUtc: raw.endsAtUtc,
        endsAtTz: raw.endsAtTz,
        endTimeIsApproximate: raw.endTimeIsApproximate,
        status: raw.status,
        rawJson: raw.raw as object,
      })
      .onConflictDoUpdate({
        target: [listings.sourceId, listings.sourceListingId],
        set: {
          auctionId,
          url: raw.url,
          title: raw.title,
          description: raw.description,
          thumbUrl: raw.thumbUrl,
          lotNo: raw.lotNo,
          currency: raw.currency,
          priceKind: raw.priceKind,
          priceAmount: money(raw.priceAmount),
          priceAmountHigh: money(raw.priceAmountHigh),
          rawPriceText: raw.rawPriceText,
          estimateLow: money(raw.estimateLow),
          estimateHigh: money(raw.estimateHigh),
          rawEstimateText: raw.rawEstimateText,
          endsAtUtc: raw.endsAtUtc,
          endTimeIsApproximate: raw.endTimeIsApproximate,
          status: raw.status,
          lastSeenAt: new Date(),
          rawJson: raw.raw as object,
        },
      })
      .returning({ id: listings.id })

    if (!row) continue
    listingIds.push(row.id)

    await db
      .insert(listingKeywords)
      .values({ listingId: row.id, keyword, sourceId, rank: index })
      .onConflictDoUpdate({
        target: [listingKeywords.listingId, listingKeywords.keyword],
        set: { rank: index, lastMatchedAt: new Date(), missingStreak: 0 },
      })
  }

  return { listingIds }
}

/**
 * Tang missingStreak cho nhung listing tung khop tu khoa nay nhung lan crawl
 * vua roi khong thay. >=3 lan lien tiep -> stale (AC3), khong bao gio xoa.
 */
export async function markMissing(
  db: Db,
  sourceId: string,
  keyword: string,
  seenListingIds: string[],
): Promise<number> {
  // Buoc 1: tang streak tren dung cap (listing, keyword) vua khong thay.
  const missConditions = [
    eq(listingKeywords.keyword, keyword),
    eq(listingKeywords.sourceId, sourceId),
  ]
  if (seenListingIds.length > 0) {
    missConditions.push(notInArray(listingKeywords.listingId, seenListingIds))
  }

  await db
    .update(listingKeywords)
    .set({ missingStreak: sql`${listingKeywords.missingStreak} + 1` })
    .where(and(...missConditions))

  // Buoc 2: chi danh dau stale khi MOI tu khoa dan toi listing deu mat dau no
  // >=3 lan. Mot mon con dung top cua bat ky tu khoa nao thi van dang song.
  const result = await db
    .update(listings)
    .set({ status: 'stale' })
    .where(
      and(
        eq(listings.sourceId, sourceId),
        eq(listings.status, 'active'),
        sql`not exists (
          select 1 from listing_keywords lk
           where lk.listing_id = ${listings.id} and lk.missing_streak < 3
        )`,
        sql`exists (
          select 1 from listing_keywords lk where lk.listing_id = ${listings.id}
        )`,
      ),
    )

  return result.rowCount ?? 0
}
