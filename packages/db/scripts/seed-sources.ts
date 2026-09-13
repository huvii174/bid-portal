import { getDb, getPool, sources, settings } from '../src/index.js'

const SOURCES = [
  {
    id: 'hibid',
    name: 'HiBid',
    baseUrl: 'https://hibid.com',
    enabled: true,
    minRequestIntervalMs: 2000,
    robotsNote:
      'robots.txt (User-agent: *) khong chan /lots?q=. Chi chan /auctions/past/*?q=*, livecatalog, webcast, auctioneer, account, catalog/print, current/map. Khong co Crawl-delay cho UA *; ta tu ap >=2s.',
  },
]

const DEFAULT_SETTINGS = [
  { key: 'display_timezone', value: process.env.DISPLAY_TIMEZONE ?? 'Asia/Ho_Chi_Minh' },
  { key: 'daily_page_budget', value: process.env.DAILY_PAGE_BUDGET ?? '300' },
  { key: 'pages_per_search', value: process.env.PAGES_PER_SEARCH ?? '2' },
  { key: 'keyword_cache_ttl_hours', value: process.env.KEYWORD_CACHE_TTL_HOURS ?? '6' },
]

async function main() {
  const db = getDb()

  for (const s of SOURCES) {
    await db
      .insert(sources)
      .values(s)
      .onConflictDoUpdate({
        target: sources.id,
        set: { name: s.name, baseUrl: s.baseUrl, robotsNote: s.robotsNote },
      })
    console.log(`source ok: ${s.id}`)
  }

  for (const s of DEFAULT_SETTINGS) {
    await db.insert(settings).values(s).onConflictDoNothing({ target: settings.key })
    console.log(`setting ok: ${s.key}`)
  }

  await getPool().end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
