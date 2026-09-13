import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm'
import {
  auctionHouses,
  auctions,
  keywordCache,
  listingKeywords,
  listings,
  sources,
  watchlistItems,
} from './schema'
import type { Db } from './index'

export interface ResultRow {
  id: string
  sourceId: string
  url: string
  title: string
  thumbUrl: string | null
  lotNo: string | null
  currency: string | null
  priceKind: string
  priceAmount: string | null
  priceAmountHigh: string | null
  estimateLow: string | null
  estimateHigh: string | null
  rawEstimateText: string | null
  endsAtUtc: Date | null
  endTimeIsApproximate: boolean
  status: string
  houseName: string | null
  watchlisted: boolean
}

export function normalizeKeyword(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Ket qua cho mot tu khoa, giu nguyen thu tu xep hang cua nguon.
 * Doc tu index da crawl — khong bao gio crawl truc tiep trong request cua user.
 */
export async function getResultsForKeyword(
  db: Db,
  keyword: string,
  userId: string,
): Promise<ResultRow[]> {
  const rows = await db
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
      rank: listingKeywords.rank,
      watchlisted: sql<boolean>`${watchlistItems.id} is not null`,
    })
    .from(listingKeywords)
    .innerJoin(listings, eq(listings.id, listingKeywords.listingId))
    .leftJoin(auctions, eq(auctions.id, listings.auctionId))
    .leftJoin(auctionHouses, eq(auctionHouses.id, auctions.auctionHouseId))
    .leftJoin(
      watchlistItems,
      and(eq(watchlistItems.listingId, listings.id), eq(watchlistItems.userId, userId)),
    )
    .where(eq(listingKeywords.keyword, keyword))
    .orderBy(asc(listingKeywords.rank))

  return rows.map(({ rank: _rank, ...row }) => row)
}

export interface CacheState {
  /** Moi nguon dang bat deu con cache chua het han. */
  fresh: boolean
  lastCheckedAt: Date | null
  staleSources: string[]
}

export async function getCacheState(db: Db, keyword: string): Promise<CacheState> {
  const enabled = await db.select({ id: sources.id }).from(sources).where(eq(sources.enabled, true))
  const enabledIds = enabled.map((s) => s.id)

  if (enabledIds.length === 0) {
    return { fresh: false, lastCheckedAt: null, staleSources: [] }
  }

  const cached = await db
    .select({ sourceId: keywordCache.sourceId, fetchedAt: keywordCache.fetchedAt })
    .from(keywordCache)
    .where(
      and(
        eq(keywordCache.keyword, keyword),
        inArray(keywordCache.sourceId, enabledIds),
        gt(keywordCache.expiresAt, new Date()),
      ),
    )

  const freshIds = new Set(cached.map((c) => c.sourceId))
  const lastCheckedAt = cached.reduce<Date | null>(
    (acc, c) => (!acc || c.fetchedAt > acc ? c.fetchedAt : acc),
    null,
  )

  return {
    fresh: enabledIds.every((id) => freshIds.has(id)),
    lastCheckedAt,
    staleSources: enabledIds.filter((id) => !freshIds.has(id)),
  }
}
