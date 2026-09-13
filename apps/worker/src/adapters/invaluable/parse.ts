import type { AuctionFormat, ListingStatus, PriceKind } from '@bid/db/schema'
import type { RawListing, SearchPage } from '../types'

export class InvaluableParseError extends Error {}

type Json = Record<string, unknown>

/**
 * Cac truong chua ID NGUOI DUNG Invaluable dang theo doi lot (ai luu mon nao).
 * Do la du lieu ca nhan cua nguoi dung ho, khong lien quan gi toi mon hang.
 * Loai bo ngay tai tang parse de chung khong bao gio cham toi DB hay raw_json.
 */
const PERSONAL_FIELDS = ['watched', 'watchedRefs', 'winner', 'winnerRef', 'bids'] as const

function stripPersonalFields(hit: Json): Json {
  const clean: Json = {}
  for (const [k, v] of Object.entries(hit)) {
    if ((PERSONAL_FIELDS as readonly string[]).includes(k)) continue
    if (k.startsWith('_')) continue // _highlightResult, _geoloc: khong can luu
    clean[k] = v
  }
  return clean
}

/** 0 nghia la "khong co uoc tinh", khong phai "uoc tinh bang 0". */
function positive(v: number | undefined): number | undefined {
  return v !== undefined && v > 0 ? v : undefined
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

/** Invaluable dung unix giay; 0 nghia la "chua co", khong phai 1970. */
function unixToDate(v: unknown): Date | undefined {
  const n = num(v)
  if (!n || n <= 0) return undefined
  return new Date(n * 1000)
}

function auctionFormat(hit: Json): AuctionFormat {
  const saleType = str(hit.saleType)?.toLowerCase() ?? ''
  if (saleType.includes('live')) return 'live'
  if (saleType.includes('timed') || hit.onlineOnly === true) return 'timed'
  return 'unknown'
}

function listingStatus(hit: Json): ListingStatus {
  if (hit.banned === true || hit.unlotted === true) return 'withdrawn'
  if (hit.closed === true) return (num(hit.priceResult) ?? 0) > 0 ? 'sold' : 'ended'
  return 'active'
}

function livePrice(hit: Json): { kind: PriceKind; amount?: number; rawText?: string } {
  const priceResult = num(hit.priceResult) ?? 0
  const currentBid = num(hit.currentBid) ?? 0
  const bidCount = num(hit.bidCount) ?? 0
  const reservePrice = num(hit.reservePrice) ?? 0

  if (hit.closed === true && priceResult > 0) {
    return { kind: 'sold', amount: priceResult, rawText: `Sold ${priceResult}` }
  }
  if (bidCount > 0 && currentBid > 0) {
    return {
      kind: 'current_bid',
      amount: currentBid,
      rawText: `Current bid ${currentBid} (${bidCount} bids)`,
    }
  }
  if (reservePrice > 0) {
    return { kind: 'starting_bid', amount: reservePrice, rawText: `Reserve ${reservePrice}` }
  }
  return { kind: 'unknown' }
}

export function parseInvaluableResponse(body: unknown, page = 1): SearchPage {
  const payload = body as Json | undefined
  if (!payload || typeof payload !== 'object') {
    throw new InvaluableParseError('Algolia response is not an object')
  }
  if (payload.message && !payload.hits) {
    throw new InvaluableParseError(`Algolia returned an error: ${String(payload.message).slice(0, 160)}`)
  }

  const hits = Array.isArray(payload.hits) ? (payload.hits as Json[]) : null
  if (!hits) {
    if (page === 1) {
      throw new InvaluableParseError('page 1 has no hits array — anomalous response')
    }
    return { listings: [], isLastPage: true, httpRequests: 1 }
  }

  const hitsPerPage = num(payload.hitsPerPage) ?? hits.length
  const nbPages = num(payload.nbPages) ?? 1
  const listings: RawListing[] = []

  for (const hit of hits) {
    const lotRef = str(hit.lotRef)
    const objectId = str(hit.objectID) ?? (num(hit.objectID) !== undefined ? String(hit.objectID) : undefined)
    const id = lotRef ?? objectId
    const title = str(hit.lotTitle)
    if (!id || !title) continue

    const price = livePrice(hit)
    const estimateLow = positive(num(hit.estimateLow))
    const estimateHigh = positive(num(hit.estimateHigh))
    const currency = str(hit.currencyCode)
    const useEstimateAsPrice = price.kind === 'unknown' && estimateLow !== undefined
    const photoPath = str(hit.photoPath)

    listings.push({
      sourceListingId: id,
      // Dinh dang URL lot cua Invaluable: /auction-lot/-<lotRef>
      url: `https://www.invaluable.com/auction-lot/-${id}`,
      title,
      description: str(hit.lotDescription),
      thumbUrl: photoPath
        ? `https://image.invaluable.com/housePhotos/${photoPath}`
        : undefined,
      sourceCategory: [str(hit.categoryName), str(hit.subcategoryName)]
        .filter(Boolean)
        .join(' / ') || undefined,
      lotNo: hit.lotNumber !== undefined && hit.lotNumber !== null ? String(hit.lotNumber) : undefined,

      currency,
      priceKind: useEstimateAsPrice ? 'estimate' : price.kind,
      priceAmount: useEstimateAsPrice ? estimateLow : price.amount,
      priceAmountHigh: useEstimateAsPrice ? estimateHigh : undefined,
      rawPriceText: useEstimateAsPrice
        ? `Estimate ${estimateLow}-${estimateHigh} ${currency ?? ''}`.trim()
        : price.rawText,

      estimateLow,
      estimateHigh,
      rawEstimateText:
        estimateLow !== undefined
          ? `${estimateLow} - ${estimateHigh ?? estimateLow} ${currency ?? ''}`.trim()
          : undefined,

      endsAtUtc: unixToDate(hit.endTimeUTCUnix) ?? unixToDate(hit.dateTimeUTCUnix),
      endTimeIsApproximate: auctionFormat(hit) === 'live',

      status: listingStatus(hit),
      auction: str(hit.catalogRef)
        ? {
            sourceAuctionId: str(hit.catalogRef)!,
            format: auctionFormat(hit),
            currency,
            startsAtUtc: unixToDate(hit.dateTimeUTCUnix),
            house: str(hit.houseName)
              ? {
                  sourceHouseId: str(hit.houseRef) ?? str(hit.houseName)!,
                  name: str(hit.houseName)!,
                }
              : undefined,
          }
        : undefined,
      raw: stripPersonalFields(hit),
    })
  }

  return {
    listings,
    isLastPage: hits.length < hitsPerPage || page >= nbPages,
    httpRequests: 1,
  }
}
