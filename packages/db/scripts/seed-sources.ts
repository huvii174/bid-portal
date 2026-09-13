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
  },
  {
    id: 'liveauctioneers',
    name: 'LiveAuctioneers',
    baseUrl: 'https://www.liveauctioneers.com',
    enabled: true,
    minRequestIntervalMs: 5000,
  },
  {
    id: 'invaluable',
    name: 'Invaluable',
    baseUrl: 'https://www.invaluable.com',
    enabled: true,
    minRequestIntervalMs: 10_000,
  },
]

const DEFAULT_SETTINGS = [
  { key: 'display_timezone', value: process.env.DISPLAY_TIMEZONE ?? 'Asia/Ho_Chi_Minh' },
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
        set: { name: s.name, baseUrl: s.baseUrl },
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
