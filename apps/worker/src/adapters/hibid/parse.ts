import type { AuctionFormat, ListingStatus, PriceKind } from '@bid/db/schema'
import type { RawAuction, RawListing, SearchPage } from '../types'

const STATE_RE = /<script[^>]*id="hibid-state"[^>]*>([\s\S]*?)<\/script>/

export class HibidParseError extends Error {}

interface ApolloRef {
  __ref: string
}

type ApolloEntity = Record<string, unknown>

function isRef(v: unknown): v is ApolloRef {
  return typeof v === 'object' && v !== null && typeof (v as ApolloRef).__ref === 'string'
}

/**
 * "2,000.00 - 4,000.00 USD" -> { low: 2000, high: 4000, currency: 'USD' }
 * "1,500.00 USD"            -> { low: 1500, high: 1500, currency: 'USD' }
 * ""                        -> undefined
 *
 * Chuỗi tự do của HiBid, nên parser phải chịu được mọi biến thể và luôn
 * trả kèm nguyên văn cho tầng trên lưu lại.
 */
export function parseEstimate(
  text: unknown,
): { low?: number; high?: number; currency?: string; raw: string } | undefined {
  if (typeof text !== 'string') return undefined
  const raw = text.trim()
  if (!raw) return undefined

  const currency = raw.match(/\b([A-Z]{3})\b\s*$/)?.[1]
  const numbers = [...raw.matchAll(/\d[\d,]*(?:\.\d+)?/g)]
    .map((m) => Number(m[0].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n))

  if (numbers.length === 0) return { currency, raw }
  const low = numbers[0]
  const high = numbers.length > 1 ? numbers[1] : numbers[0]
  return { low, high, currency, raw }
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : undefined
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function date(v: unknown): Date | undefined {
  const s = str(v)
  if (!s) return undefined
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? undefined : d
}

/** Slug theo đúng cách HiBid dựng URL lot. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

/**
 * Quyết định giá "sống" để hiển thị. Không bao giờ trộn với estimate —
 * estimate được giữ riêng ở trường của nó.
 */
function livePrice(lotState: ApolloEntity, lot: ApolloEntity): {
  kind: PriceKind
  amount?: number
  rawText?: string
} {
  const priceRealized = num(lotState.priceRealized) ?? 0
  const highBid = num(lotState.highBid) ?? 0
  const bidCount = num(lotState.bidCount) ?? 0
  const buyNow = num(lotState.buyNow) ?? 0
  const minBid = num(lotState.minBid) ?? 0
  const bidAmount = num(lot.bidAmount) ?? 0
  const isClosed = lotState.isClosed === true

  if (isClosed && priceRealized > 0) {
    return { kind: 'sold', amount: priceRealized, rawText: `Sold ${priceRealized}` }
  }
  if (bidCount > 0) {
    const amount = highBid > 0 ? highBid : bidAmount
    return { kind: 'current_bid', amount, rawText: `Current bid ${amount} (${bidCount} bids)` }
  }
  if (buyNow > 0) {
    return { kind: 'buy_now', amount: buyNow, rawText: `Buy now ${buyNow}` }
  }
  if (minBid > 0) {
    return { kind: 'starting_bid', amount: minBid, rawText: `Starting bid ${minBid}` }
  }
  return { kind: 'unknown' }
}

function listingStatus(lotState: ApolloEntity): ListingStatus {
  if (lotState.isArchived === true) return 'ended'
  if (lotState.isClosed === true) {
    return (num(lotState.priceRealized) ?? 0) > 0 ? 'sold' : 'ended'
  }
  return 'active'
}

function auctionFormat(auction: ApolloEntity): AuctionFormat {
  const bidType = str(auction.bidType)?.toUpperCase() ?? ''
  if (bidType.includes('LIVE') || bidType.includes('SIMULCAST')) return 'live'
  if (bidType.includes('TIMED') || bidType.includes('INTERNET')) return 'timed'
  if (bidType.includes('SEALED')) return 'sealed'
  return 'unknown'
}

function buildAuction(
  auction: ApolloEntity | undefined,
  apollo: Record<string, ApolloEntity>,
): RawAuction | undefined {
  if (!auction) return undefined

  const houseRef = isRef(auction.auctioneer) ? apollo[auction.auctioneer.__ref] : undefined
  const sourceAuctionId = String(auction.id ?? '')
  if (!sourceAuctionId) return undefined

  return {
    sourceAuctionId,
    title: str(auction.eventName),
    format: auctionFormat(auction),
    currency: str(auction.currencyAbbreviation),
    buyerPremiumRate: num(auction.buyerPremiumRate),
    startsAtUtc: date(auction.bidOpenDateTime) ?? date(auction.eventDateBegin),
    endsAtUtc: date(auction.bidCloseDateTime) ?? date(auction.eventDateEnd),
    house:
      houseRef && str(houseRef.name)
        ? {
            sourceHouseId: String(houseRef.id ?? sourceAuctionId),
            name: str(houseRef.name)!,
            city: str(auction.eventCity),
            state: str(auction.eventState),
          }
        : undefined,
  }
}

/**
 * HiBid nhúng Apollo cache vào trang tìm kiếm, nên ta đọc JSON có cấu trúc
 * thay vì bám vào CSS selector. Xem docs/SPIKE-hibid.md.
 */
export function parseHibidSearchHtml(html: string): SearchPage {
  const match = html.match(STATE_RE)
  if (!match?.[1]) {
    throw new HibidParseError('khong tim thay <script id="hibid-state"> — HiBid co the da bo TransferState')
  }

  let state: unknown
  try {
    state = JSON.parse(match[1].trim())
  } catch (err) {
    throw new HibidParseError(`hibid-state khong phai JSON hop le: ${(err as Error).message}`)
  }

  const apollo = (state as Record<string, unknown>)['apollo.state'] as
    | Record<string, ApolloEntity>
    | undefined
  if (!apollo) throw new HibidParseError('thieu khoa "apollo.state"')

  const rootQuery = apollo.ROOT_QUERY
  if (!rootQuery) throw new HibidParseError('thieu ROOT_QUERY')

  const searchKey = Object.keys(rootQuery).find((k) => k.startsWith('lotSearch('))
  if (!searchKey) throw new HibidParseError('thieu ROOT_QUERY.lotSearch(...)')

  const paged = (rootQuery[searchKey] as ApolloEntity | undefined)?.pagedResults as
    | ApolloEntity
    | undefined
  if (!paged) throw new HibidParseError('thieu pagedResults')

  const results = Array.isArray(paged.results) ? paged.results : []
  // pageLength la kich thuoc trang cua HiBid. Canh bao trong SPIKE: totalCount
  // chi dem so lot duoc hydrate, KHONG phai tong ket qua toan cuc.
  const pageLength = num(paged.pageLength) ?? results.length

  const listings: RawListing[] = []

  for (const ref of results) {
    if (!isRef(ref)) continue
    const lot = apollo[ref.__ref]
    if (!lot) continue

    const id = String(lot.id ?? '')
    const title = str(lot.lead)
    if (!id || !title) continue

    const lotState = (lot.lotState as ApolloEntity | undefined) ?? {}
    const auctionEntity = isRef(lot.auction) ? apollo[lot.auction.__ref] : undefined
    const auction = buildAuction(auctionEntity, apollo)

    const price = livePrice(lotState, lot)
    const estimate = parseEstimate(lot.estimate)
    const picture = lot.featuredPicture as ApolloEntity | undefined

    // Neu khong co gia song nao thi dung estimate lam gia hien thi chinh.
    const useEstimateAsPrice = price.kind === 'unknown' && estimate?.low !== undefined

    listings.push({
      sourceListingId: id,
      url: `https://hibid.com/lot/${id}/${slugify(title)}`,
      title,
      description: str(lot.description),
      thumbUrl: str(picture?.hdThumbnailLocation) ?? str(picture?.thumbnailLocation),
      lotNo: lot.lotNumber !== undefined && lot.lotNumber !== null ? String(lot.lotNumber) : undefined,

      currency: auction?.currency ?? estimate?.currency,
      priceKind: useEstimateAsPrice ? 'estimate' : price.kind,
      priceAmount: useEstimateAsPrice ? estimate?.low : price.amount,
      priceAmountHigh: useEstimateAsPrice ? estimate?.high : undefined,
      rawPriceText: useEstimateAsPrice ? estimate?.raw : price.rawText,

      estimateLow: estimate?.low,
      estimateHigh: estimate?.high,
      rawEstimateText: estimate?.raw,

      endsAtUtc: auction?.endsAtUtc,
      endsAtTz: 'UTC',
      // Phien live dong tung lot noi tiep nhau, gio dong cua ca phien chi la xap xi.
      endTimeIsApproximate: auction?.format === 'live',

      status: listingStatus(lotState),
      auction,
      raw: lot,
    })
  }

  return { listings, pageLength }
}
