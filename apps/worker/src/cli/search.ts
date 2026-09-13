import { createHibidAdapter } from '../adapters/hibid/index'
import { createLiveAuctioneersAdapter } from '../adapters/liveauctioneers/index'
import { createInvaluableAdapter } from '../adapters/invaluable/index'

/**
 * Thu adapter truc tiep, khong qua DB:
 *   npm run -w @bid/worker search -- "rococo table" [trang]
 */
const keyword = process.argv[2]
const page = Number(process.argv[3] ?? '1')

if (!keyword) {
  console.error('Usage: npm run -w @bid/worker search -- "<tu khoa>" [trang]')
  process.exit(1)
}

const sourceId = process.env.SOURCE ?? 'hibid'
const adapter =
  sourceId === 'liveauctioneers'
    ? createLiveAuctioneersAdapter(5000)
    : sourceId === 'invaluable'
      ? createInvaluableAdapter(10_000)
      : createHibidAdapter(2000)
const startedAt = Date.now()
const result = await adapter.search(keyword, page)

console.log(
  `${result.listings.length} listing(s) trong ${Date.now() - startedAt}ms · ${result.isLastPage ? 'trang cuoi' : 'con trang tiep'}`,
)

for (const l of result.listings.slice(0, 5)) {
  const price =
    l.priceAmount !== undefined ? `${l.priceKind} ${l.priceAmount} ${l.currency ?? ''}` : l.priceKind
  const estimate =
    l.estimateLow !== undefined ? ` · est ${l.estimateLow}-${l.estimateHigh}` : ''
  console.log(`- [${l.sourceListingId}] ${l.title.slice(0, 58)}`)
  console.log(`    ${price}${estimate} · ${l.status} · ${l.auction?.house?.name ?? '?'}`)
  console.log(`    ${l.url}`)
}
