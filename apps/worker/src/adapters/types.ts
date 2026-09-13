import type { AuctionFormat, ListingStatus, PriceKind } from '@bid/db/schema'

export interface RawAuctionHouse {
  sourceHouseId: string
  name: string
  city?: string
  state?: string
}

export interface RawAuction {
  sourceAuctionId: string
  title?: string
  format: AuctionFormat
  currency?: string
  buyerPremiumRate?: number
  startsAtUtc?: Date
  endsAtUtc?: Date
  house?: RawAuctionHouse
}

export interface RawListing {
  sourceListingId: string
  url: string
  title: string
  description?: string
  thumbUrl?: string
  sourceCategory?: string
  lotNo?: string

  currency?: string
  priceKind: PriceKind
  priceAmount?: number
  priceAmountHigh?: number
  rawPriceText?: string

  estimateLow?: number
  estimateHigh?: number
  rawEstimateText?: string

  endsAtUtc?: Date
  endsAtTz?: string
  endTimeIsApproximate: boolean

  status: ListingStatus
  auction?: RawAuction
  raw: unknown
}

export interface SearchPage {
  listings: RawListing[]
  /** Số item tối đa mà nguồn trả về cho một trang — dùng để biết đã hết trang chưa. */
  pageLength: number
}

export interface Adapter {
  readonly id: string
  /** page bắt đầu từ 1. */
  search(keyword: string, page: number): Promise<SearchPage>
}
