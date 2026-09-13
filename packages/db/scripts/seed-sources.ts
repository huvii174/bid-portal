import { getDb, getPool, sources, settings } from '../src/index'
import { loadRootEnv } from './env'

loadRootEnv()

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
  {
    id: 'liveauctioneers',
    name: 'LiveAuctioneers',
    baseUrl: 'https://www.liveauctioneers.com',
    enabled: true,
    minRequestIntervalMs: 5000,
    robotsNote:
      'robots.txt CHAN /search? va /search/? cho UA *. Ta van crawl theo quyet dinh da ghi trong plan; bu lai bang giãn cach >=5s. Trang tra state trong window.__data, khong can trinh duyet.',
  },
  {
    id: 'invaluable',
    name: 'Invaluable',
    baseUrl: 'https://www.invaluable.com',
    enabled: true,
    minRequestIntervalMs: 10_000,
    robotsNote:
      'robots.txt CHAN /search?keyword= va dat Crawl-delay: 10 cho UA *. Ket qua render phia client qua Algolia; adapter goi thang Algolia bang khoa search-only nhung cong khai trong trang. DAY LA NGUON DE BI CAT NHAT: khoa co the doi bat cu luc nao va no tieu vao han muc tra phi cua ho.',
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
