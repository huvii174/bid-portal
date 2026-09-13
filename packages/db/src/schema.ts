import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  uuid,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const ROLES = ['admin', 'member'] as const
export type Role = (typeof ROLES)[number]

/**
 * Loại giá. Không bao giờ so sánh trực tiếp hai listing khác priceKind —
 * "ước tính 2000-4000" và "giá hiện tại 123" là hai đại lượng khác nhau.
 */
export const PRICE_KINDS = [
  'estimate',
  'current_bid',
  'starting_bid',
  'buy_now',
  'sold',
  'unknown',
] as const
export type PriceKind = (typeof PRICE_KINDS)[number]

export const LISTING_STATUSES = [
  'active',
  'ended',
  'sold',
  'withdrawn',
  'stale',
] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]

export const ADAPTER_RUN_STATUSES = [
  'ok',
  'error',
  'blocked',
  'zero_results',
] as const
export type AdapterRunStatus = (typeof ADAPTER_RUN_STATUSES)[number]

export const SEARCH_JOB_STATUSES = [
  'queued',
  'running',
  'done',
  'partial',
  'failed',
] as const
export type SearchJobStatus = (typeof SEARCH_JOB_STATUSES)[number]

export const AUCTION_FORMATS = ['timed', 'live', 'sealed', 'unknown'] as const
export type AuctionFormat = (typeof AUCTION_FORMATS)[number]

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('member').$type<Role>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Id là key ổn định ('hibid'), đọc được trực tiếp trong query và log. */
export const sources = pgTable('sources', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  baseUrl: text('base_url').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  robotsNote: text('robots_note'),
  /** Giãn cách tối thiểu giữa 2 request tới nguồn này. */
  minRequestIntervalMs: integer('min_request_interval_ms').notNull().default(2000),
})

export const searchJobs = pgTable(
  'search_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    keyword: text('keyword').notNull(),
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    savedSearchId: uuid('saved_search_id'),
    status: text('status').notNull().default('queued').$type<SearchJobStatus>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Mốc để nhặt lại job mồ côi khi worker chết giữa chừng. */
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
  },
  (t) => [index('search_jobs_keyword_idx').on(t.keyword, t.createdAt)],
)

export const adapterRuns = pgTable(
  'adapter_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    searchJobId: uuid('search_job_id').references(() => searchJobs.id, {
      onDelete: 'cascade',
    }),
    keyword: text('keyword'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    status: text('status').notNull().$type<AdapterRunStatus>(),
    itemsFound: integer('items_found').notNull().default(0),
    pagesFetched: integer('pages_fetched').notNull().default(0),
    errorText: text('error_text'),
  },
  (t) => [index('adapter_runs_source_started_idx').on(t.sourceId, t.startedAt)],
)

/**
 * Cache theo (keyword, source). Còn hạn -> trả kết quả từ DB (<1s, AC1b);
 * hết hạn -> tạo SearchJob và crawl lại (<=60s, AC1a).
 */
export const keywordCache = pgTable(
  'keyword_cache',
  {
    keyword: text('keyword').notNull(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.keyword, t.sourceId] })],
)

export const auctionHouses = pgTable(
  'auction_houses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    sourceHouseId: text('source_house_id').notNull(),
    name: text('name').notNull(),
    city: text('city'),
    state: text('state'),
  },
  (t) => [uniqueIndex('auction_houses_source_uq').on(t.sourceId, t.sourceHouseId)],
)

export const auctions = pgTable(
  'auctions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    sourceAuctionId: text('source_auction_id').notNull(),
    auctionHouseId: uuid('auction_house_id').references(() => auctionHouses.id, {
      onDelete: 'set null',
    }),
    title: text('title'),
    format: text('format').notNull().default('unknown').$type<AuctionFormat>(),
    currency: text('currency'),
    buyerPremiumRate: numeric('buyer_premium_rate', { precision: 6, scale: 3 }),
    startsAtUtc: timestamp('starts_at_utc', { withTimezone: true }),
    endsAtUtc: timestamp('ends_at_utc', { withTimezone: true }),
  },
  (t) => [uniqueIndex('auctions_source_uq').on(t.sourceId, t.sourceAuctionId)],
)

export const listings = pgTable(
  'listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    sourceListingId: text('source_listing_id').notNull(),
    auctionId: uuid('auction_id').references(() => auctions.id, { onDelete: 'set null' }),
    url: text('url').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    thumbUrl: text('thumb_url'),
    sourceCategory: text('source_category'),
    lotNo: text('lot_no'),

    // Giá "sống" (bid hiện tại / mua ngay / giá chốt). priceAmountHigh chỉ dùng
    // khi priceKind='estimate' và không có giá sống nào.
    currency: text('currency'),
    priceKind: text('price_kind').notNull().default('unknown').$type<PriceKind>(),
    priceAmount: numeric('price_amount', { precision: 14, scale: 2 }),
    priceAmountHigh: numeric('price_amount_high', { precision: 14, scale: 2 }),
    rawPriceText: text('raw_price_text'),

    // Ước tính của nhà đấu giá, giữ song song với giá sống — "bid $123 /
    // ước tính $2.000-4.000" mới là phép so sánh mà dân đồ cổ cần.
    estimateLow: numeric('estimate_low', { precision: 14, scale: 2 }),
    estimateHigh: numeric('estimate_high', { precision: 14, scale: 2 }),
    rawEstimateText: text('raw_estimate_text'),

    // Thời gian: UTC + tz gốc + cờ xấp xỉ (phiên live không có giờ đóng chính xác).
    endsAtUtc: timestamp('ends_at_utc', { withTimezone: true }),
    endsAtTz: text('ends_at_tz'),
    endTimeIsApproximate: boolean('end_time_is_approximate').notNull().default(false),

    status: text('status').notNull().default('active').$type<ListingStatus>(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    /** >=3 lần crawl liên tiếp vắng mặt -> đánh dấu stale, không xoá (AC3). */
    missingStreak: integer('missing_streak').notNull().default(0),
    rawJson: jsonb('raw_json'),
  },
  (t) => [
    uniqueIndex('listings_source_uq').on(t.sourceId, t.sourceListingId),
    index('listings_status_ends_idx').on(t.status, t.endsAtUtc),
    index('listings_fts_idx').using(
      'gin',
      sql`to_tsvector('simple', ${t.title} || ' ' || coalesce(${t.description}, ''))`,
    ),
  ],
)

/** Listing nào thuộc từ khóa nào, giữ nguyên thứ tự xếp hạng của nguồn. */
export const listingKeywords = pgTable(
  'listing_keywords',
  {
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    keyword: text('keyword').notNull(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull().default(0),
    lastMatchedAt: timestamp('last_matched_at', { withTimezone: true }).notNull().defaultNow(),
    /**
     * Đếm theo (listing, keyword) chứ không theo listing: một món khớp cả
     * "lamp" lẫn "tiffany lamp" có thể rơi khỏi bảng xếp hạng của một từ khóa
     * trong khi vẫn đang đấu giá bình thường. Chỉ khi TẤT CẢ từ khóa đều mất
     * dấu nó mới thực sự đáng ngờ.
     */
    missingStreak: integer('missing_streak').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.listingId, t.keyword] }),
    index('listing_keywords_keyword_idx').on(t.keyword, t.rank),
  ],
)

export const savedSearches = pgTable(
  'saved_searches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    keyword: text('keyword').notNull(),
    cadenceHours: integer('cadence_hours').notNull().default(12),
    enabled: boolean('enabled').notNull().default(true),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('saved_searches_user_keyword_uq').on(t.userId, t.keyword)],
)

/**
 * "Hàng mới" = lần đầu xuất hiện cặp (savedSearch, listing).
 * notifiedAt set một lần duy nhất -> không bao giờ báo lại, kể cả khi
 * listing stale rồi xuất hiện trở lại (AC11).
 */
export const searchMatches = pgTable(
  'search_matches',
  {
    savedSearchId: uuid('saved_search_id')
      .notNull()
      .references(() => savedSearches.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.savedSearchId, t.listingId] })],
)

export const watchlistItems = pgTable(
  'watchlist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('watchlist_user_listing_uq').on(t.userId, t.listingId)],
)

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().$type<'digest' | 'adapter_alert'>(),
  payloadJson: jsonb('payload_json'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
})

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export type User = typeof users.$inferSelect
export type Source = typeof sources.$inferSelect
export type Listing = typeof listings.$inferSelect
export type NewListing = typeof listings.$inferInsert
export type Auction = typeof auctions.$inferSelect
export type AdapterRun = typeof adapterRuns.$inferSelect
export type SearchJob = typeof searchJobs.$inferSelect
export type SavedSearch = typeof savedSearches.$inferSelect
