import type { AuctionFormat, ListingStatus, PriceKind } from '@bid/db/schema'
import type { RawListing, SearchPage } from '../types'

/** LiveAuctioneers tra 24 lot cho mot trang day. It hon la trang cuoi. */
export const LA_PAGE_SIZE = 24

export class LiveAuctioneersParseError extends Error {}

const STATE_MARKER = 'window.__data'

type Json = Record<string, unknown>

/**
 * Cat dung object can bang ngoac, co ton trong chuoi va escape.
 *
 * TUYET DOI khong eval/Function: day la noi dung tai ve tu site ngoai, chay no
 * la trao quyen thuc thi cho ho.
 */
function extractBalancedObject(source: string, from: number): string | null {
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = from; i < source.length; i++) {
    const ch = source[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return source.slice(from, i + 1)
    }
  }
  return null
}

export function readLiveAuctioneersState(html: string): Json {
  const marker = html.indexOf(STATE_MARKER)
  if (marker < 0) {
    throw new LiveAuctioneersParseError(
      'no window.__data found — LiveAuctioneers may have moved to client-side rendering',
    )
  }

  const start = html.indexOf('{', marker)
  const raw = start < 0 ? null : extractBalancedObject(html, start)
  if (!raw) throw new LiveAuctioneersParseError('could not extract the window.__data object')

  // Store duoc serialize theo kieu JS nen co `undefined` — khong hop le voi JSON.
  // Chi thay o vi tri GIA TRI, khong dung cho chuoi ben trong.
  try {
    return JSON.parse(raw.replace(/:\s*undefined\b/g, ':null')) as Json
  } catch (err) {
    throw new LiveAuctioneersParseError(`window.__data failed to parse: ${(err as Error).message}`)
  }
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

/** LiveAuctioneers dung unix giay; 0 nghia la "chua co", khong phai 1970. */
function unixToDate(v: unknown): Date | undefined {
  const n = num(v)
  if (!n || n <= 0) return undefined
  return new Date(n * 1000)
}

function auctionFormat(lot: Json): AuctionFormat {
  if (lot.isLiveAuction === true) return 'live'
  if (lot.isTimedAuction === true || lot.isTimedPlusAuction === true) return 'timed'
  return 'unknown'
}

function listingStatus(lot: Json): ListingStatus {
  if (lot.isDeleted === true) return 'withdrawn'
  if (lot.isSold === true) return 'sold'
  if (lot.isPassed === true) return 'ended'
  if (lot.isAvailable === false) return 'ended'
  return 'active'
}

/** Gia "song". Estimate duoc giu rieng, khong bao gio tron vao day. */
function livePrice(lot: Json): { kind: PriceKind; amount?: number; rawText?: string } {
  const salePrice = num(lot.salePrice) ?? 0
  const leadingBid = num(lot.leadingBid) ?? 0
  const bidCount = num(lot.bidCount) ?? 0
  const buyNowPrice = num(lot.buyNowPrice) ?? 0
  const startPrice = num(lot.startPrice) ?? 0

  if (lot.isSold === true && salePrice > 0) {
    return { kind: 'sold', amount: salePrice, rawText: `Sold ${salePrice}` }
  }
  if (bidCount > 0 && leadingBid > 0) {
    return {
      kind: 'current_bid',
      amount: leadingBid,
      rawText: `Current bid ${leadingBid} (${bidCount} bids)`,
    }
  }
  if (buyNowPrice > 0) return { kind: 'buy_now', amount: buyNowPrice, rawText: `Buy now ${buyNowPrice}` }
  if (startPrice > 0) {
    return { kind: 'starting_bid', amount: startPrice, rawText: `Starting bid ${startPrice}` }
  }
  return { kind: 'unknown' }
}

/**
 * Duong dan anh can CA sellerId LAN catalogId, khong chi itemId.
 * Bien the `_x` nhan tham so height nen ta xin thang ban <=400px theo quy tac
 * cua plan, thay vi tai anh goc roi thu nho.
 */
function imageUrl(lot: Json): string | undefined {
  const itemId = num(lot.itemId)
  const sellerId = num(lot.sellerId)
  const catalogId = num(lot.catalogId)
  const photos = Array.isArray(lot.photos) ? lot.photos : []
  if (!itemId || !sellerId || !catalogId || photos.length === 0) return undefined

  const version = num(lot.imageVersion)
  const query = `height=400&quality=70${version ? `&version=${version}` : ''}`
  return `https://p1.liveauctioneers.com/${sellerId}/${catalogId}/${itemId}_1_x.jpg?${query}`
}

export function parseLiveAuctioneersSearchHtml(html: string, page = 1): SearchPage {
  const state = readLiveAuctioneersState(html)

  const search = state.search as Json | undefined
  const summary = state.itemSummary as Json | undefined
  const byId = (summary?.byId ?? {}) as Record<string, Json>

  // Trang vuot qua ket qua cuoi khong co itemIds. O TRANG 1 thi day la bat
  // thuong, khong phai het hang — cung bai hoc da tra gia voi HiBid.
  const itemIds = Array.isArray(search?.itemIds) ? (search!.itemIds as unknown[]) : null
  if (!itemIds) {
    if (page === 1) {
      throw new LiveAuctioneersParseError(
        'page 1 has no search.itemIds — anomalous page, NOT the end of results',
      )
    }
    return { listings: [], isLastPage: true, httpRequests: 1 }
  }

  const listings: RawListing[] = []

  for (const rawId of itemIds) {
    const id = String(rawId)
    const lot = byId[id]
    if (!lot) continue

    const title = str(lot.title)
    if (!title) continue

    const price = livePrice(lot)
    const estimateLow = positive(num(lot.lowBidEstimate))
    const estimateHigh = positive(num(lot.highBidEstimate))
    const currency = str(lot.currency)
    const useEstimateAsPrice = price.kind === 'unknown' && estimateLow !== undefined
    const slug = str(lot.slugWithLocation) ?? str(lot.slug) ?? ''
    const format = auctionFormat(lot)
    const catalogId = num(lot.catalogId)

    listings.push({
      sourceListingId: id,
      url: `https://www.liveauctioneers.com/item/${id}${slug ? `_${slug}` : ''}`,
      title,
      description: str(lot.shortDescription),
      thumbUrl: imageUrl(lot),
      lotNo: lot.lotNumber !== undefined && lot.lotNumber !== null ? String(lot.lotNumber) : undefined,

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

      endsAtUtc: unixToDate(lot.lotEndTimeEstimatedTs) ?? unixToDate(lot.saleEndEstimatedTs),
      // Phien live dong tung lot noi tiep nhau nen gio ket thuc chi la uoc luong —
      // chinh ten field cua ho cung noi vay (lotEndTimeEstimatedTs).
      endTimeIsApproximate: format === 'live',

      status: listingStatus(lot),
      auction: catalogId
        ? {
            sourceAuctionId: String(catalogId),
            title: str(lot.catalogTitle),
            format,
            currency,
            startsAtUtc: unixToDate(lot.saleStartTs),
            endsAtUtc: unixToDate(lot.saleEndEstimatedTs),
            house: str(lot.sellerName)
              ? {
                  sourceHouseId: String(num(lot.sellerId) ?? lot.sellerName),
                  name: str(lot.sellerName)!,
                  city: str(lot.sellerCity),
                  state: str(lot.sellerStateCode),
                }
              : undefined,
          }
        : undefined,
      raw: lot,
    })
  }

  return {
    listings,
    isLastPage: itemIds.length < LA_PAGE_SIZE,
    httpRequests: 1,
  }
}
