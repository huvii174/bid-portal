import { getDb, getPool } from '@bid/db'
import { loadRootEnv } from '../env'
import { runSearch } from '../pipeline/run-search'

/**
 * Crawl mot tu khoa vao DB:
 *   npm run -w @bid/worker crawl -- "rococo table"
 */
loadRootEnv()

const keyword = process.argv[2]
if (!keyword) {
  console.error('Usage: npm run -w @bid/worker crawl -- "<tu khoa>"')
  process.exit(1)
}

const db = getDb()
const results = await runSearch(db, keyword)

for (const r of results) {
  const detail = r.errorText ? ` — ${r.errorText}` : ''
  console.log(`${r.sourceId}: ${r.status} · ${r.itemsFound} item · ${r.pagesFetched} trang${detail}`)
}

await getPool().end()
