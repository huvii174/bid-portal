import type { AuctionFormat, ListingStatus, PriceKind } from '@bid/db/schema'
import type { RawAuction, RawListing, SearchPage } from '../types'

const STATE_RE = /<script[^>]*id="hibid-state"[^>]*>([\s\S]*?)<\/script>/

/**
 * HiBid tra ve 100 lot cho mot trang day. Mot trang it hon 100 la trang cuoi.
 * KHONG dung pagedResults.pageLength cho viec nay: no luon bang dung so lot
 * duoc hydrate, nen so sanh voi no thi khong bao gio phat hien duoc trang cuoi.
 */
export const HIBID_PAGE_SIZE = 100

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
/**
 * "2,000.00" (Anh-My) va "1.500,00" (chau Au) doi nhau vai tro dau phay/cham.
 * Dau phan cach thap phan la dau NAM SAU CUNG — quy tac nay dung cho ca hai.
 */
export function parseAmount(token: string): number | undefined {
  const lastComma = token.lastIndexOf(',')
  const lastDot = token.lastIndexOf('.')
  const normalized =
    lastComma > lastDot
      ? token.replace(/\./g, '').replace(',', '.')
      : token.replace(/,/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : undefined
}

export function parseEstimate(
  text: unknown,
): { low?: number; high?: number; currency?: string; raw: string } | undefined {
  if (typeof text !== 'string') return undefined
  const raw = text.trim()
  if (!raw) return undefined

  const currency = raw.match(/\b([A-Z]{3})\b\s*$/)?.[1]
  const numbers = [...raw.matchAll(/\d[\d.,]*\d|\d/g)]
    .map((m) => parseAmount(m[0]))
    .filter((n): n is number => n !== undefined)

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

const ALLOWED_IMAGE_HOSTS = new Set(['cdn.hibid.com', 'image.hibid.com'])

/**
 * Ảnh đến từ dữ liệu crawl về, tức là do bên ngoài kiểm soát. Không chặn host
 * thì một listing độc hại đủ để bắt trình duyệt của cả đội gọi tới máy chủ
 * bất kỳ mỗi lần xem kết quả.
 */
function safeImageUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return undefined
    return ALLOWED_IMAGE_HOSTS.has(url.hostname) ? raw : undefined
  } catch {
    return undefined
  }
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
  // Co luot dat gia nhung khong co so tien nao thi KHONG bia ra "gia hien tai 0" —
  // roi xuong cac kha nang duoi, cung lam khong biet gia con hon bao sai gia.
  const bidNow = highBid > 0 ? highBid : bidAmount
  if (bidCount > 0 && bidNow > 0) {
    return { kind: 'current_bid', amount: bidNow, rawText: `Current bid ${bidNow} (${bidCount} bids)` }
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

function readApolloState(html: string): Record<string, ApolloEntity> {
  const match = html.match(STATE_RE)
  if (!match?.[1]) {
    throw new HibidParseError(
      'khong tim thay <script id="hibid-state"> — HiBid co the da bo TransferState',
    )
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
  return apollo
}

export interface LotRefresh {
  priceKind: PriceKind
  priceAmount?: number
  priceAmountHigh?: number
  rawPriceText?: string
  estimateLow?: number
  estimateHigh?: number
  rawEstimateText?: string
  currency?: string
  status: ListingStatus
}

/**
 * Trang mot lot mang theo dung entity Lot:<id> trong cache, nen tra cuu truc
 * tiep theo id — khong phu thuoc vao hinh dang khoa ROOT_QUERY.
 */
export function parseHibidLotHtml(html: string, sourceListingId: string): LotRefresh | null {
  const apollo = readApolloState(html)
  const lot = apollo[`Lot:${sourceListingId}`]
  if (!lot) return null

  const lotState = (lot.lotState as ApolloEntity | undefined) ?? {}
  const price = livePrice(lotState, lot)
  const estimate = parseEstimate(lot.estimate)

  // Lam moi phai tra ve BUC TRANH DAY DU giong luc parse trang tim kiem, ke ca
  // estimate. Neu chi tra ve gia song thi mot lot dang hien theo estimate se bi
  // ha xuong 'unknown' va mat gia — te hon ca truoc khi lam moi.
  const useEstimateAsPrice = price.kind === 'unknown' && estimate?.low !== undefined

  return {
    priceKind: useEstimateAsPrice ? 'estimate' : price.kind,
    priceAmount: useEstimateAsPrice ? estimate?.low : price.amount,
    priceAmountHigh: useEstimateAsPrice ? estimate?.high : undefined,
    rawPriceText: useEstimateAsPrice ? estimate?.raw : price.rawText,
    estimateLow: estimate?.low,
    estimateHigh: estimate?.high,
    rawEstimateText: estimate?.raw,
    status: listingStatus(lotState),
  }
}

/**
 * HiBid nhúng Apollo cache vào trang tìm kiếm, nên ta đọc JSON có cấu trúc
 * thay vì bám vào CSS selector. Xem docs/SPIKE-hibid.md.
 */
export function parseHibidSearchHtml(html: string, page = 1): SearchPage {
  const apollo = readApolloState(html)

  const rootQuery = apollo.ROOT_QUERY
  if (!rootQuery) throw new HibidParseError('thieu ROOT_QUERY')

  // Trang vuot qua ket qua cuoi cung duoc HiBid render KHONG kem lotSearch.
  // Tren trang 2+ day la "het ket qua" binh thuong; nhung tren TRANG 1 thi
  // khong — HiBid thinh thoang tra ve dang nay mot cach ngau nhien, va coi no
  // la "het hang" se ghi 0 ket qua trong im lang cho mot tu khoa dang co 100
  // mon. Nguoi goi phai bao biet day la trang may de phan biet duoc.
  const searchKey = Object.keys(rootQuery).find((k) => k.startsWith('lotSearch('))
  const paged = searchKey
    ? ((rootQuery[searchKey] as ApolloEntity | undefined)?.pagedResults as
        | ApolloEntity
        | undefined)
    : undefined

  if (!paged) {
    if (page === 1) {
      throw new HibidParseError(
        'trang 1 khong co lotSearch — HiBid tra ve trang bat thuong, KHONG phai het hang',
      )
    }
    return { listings: [], isLastPage: true, httpRequests: 1 }
  }

  const results = Array.isArray(paged.results) ? paged.results : []

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
      thumbUrl:
        safeImageUrl(str(picture?.hdThumbnailLocation)) ??
        safeImageUrl(str(picture?.thumbnailLocation)),
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

  // So sanh voi so ref THO, khong phai mang da loc: chi can mot lot bi bo qua
  // (thieu id/lead, hoac __ref treo) tren trang day 100 la 99 < 100 -> tuong
  // nham la trang cuoi va khong bao gio lay trang 2.
  return { listings, isLastPage: results.length < HIBID_PAGE_SIZE, httpRequests: 1 }
}
