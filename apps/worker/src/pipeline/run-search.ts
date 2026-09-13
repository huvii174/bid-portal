import { eq } from 'drizzle-orm'
import { keywordCache, sources, type Db } from '@bid/db'
import { createHibidAdapter } from '../adapters/hibid/index'
import type { Adapter, RawListing } from '../adapters/types'
import { assertPageBudget, getNumericSetting, PageBudgetExceededError } from '../rate-limit'
import { finishRun, startRun } from './health'
import { markMissing, upsertListings } from './upsert'
import type { AdapterRunStatus } from '@bid/db/schema'

function adapterFor(sourceId: string, minIntervalMs: number): Adapter | null {
  if (sourceId === 'hibid') return createHibidAdapter(minIntervalMs)
  return null
}

export interface SourceResult {
  sourceId: string
  status: AdapterRunStatus | 'disabled'
  itemsFound: number
  pagesFetched: number
  errorText?: string
}

/**
 * Crawl mot tu khoa tren tat ca nguon dang bat. Khong bao gio nem ra ngoai vi
 * mot nguon hong: moi nguon tra ve trang thai rieng de UI hien "HiBid: loi"
 * thay vi mot danh sach rong im lang.
 */
export async function runSearch(
  db: Db,
  keyword: string,
  searchJobId?: string,
): Promise<SourceResult[]> {
  const allSources = await db.select().from(sources)
  const pagesPerSearch = await getNumericSetting(db, 'pages_per_search')
  const ttlHours = await getNumericSetting(db, 'keyword_cache_ttl_hours')
  const results: SourceResult[] = []

  for (const source of allSources) {
    if (!source.enabled) {
      results.push({ sourceId: source.id, status: 'disabled', itemsFound: 0, pagesFetched: 0 })
      continue
    }

    const adapter = adapterFor(source.id, source.minRequestIntervalMs)
    if (!adapter) {
      results.push({
        sourceId: source.id,
        status: 'error',
        itemsFound: 0,
        pagesFetched: 0,
        errorText: 'chua co adapter cho nguon nay',
      })
      continue
    }

    const runId = await startRun(db, source.id, keyword, searchJobId)
    const collected: RawListing[] = []
    let pagesFetched = 0
    let status: AdapterRunStatus = 'ok'
    let errorText: string | undefined

    try {
      await assertPageBudget(db, pagesPerSearch)

      for (let page = 1; page <= pagesPerSearch; page++) {
        const result = await adapter.search(keyword, page)
        pagesFetched++
        collected.push(...result.listings)
        if (result.isLastPage) break
      }
    } catch (err) {
      status = err instanceof PageBudgetExceededError ? 'blocked' : 'error'
      errorText = (err as Error).message
    }

    if (collected.length > 0) {
      const { listingIds } = await upsertListings(db, source.id, keyword, collected)
      await markMissing(db, source.id, keyword, listingIds)
    }

    // finishRun phai chay TRUOC khi quyet dinh cache: chinh no moi nang mot lan
    // chay 0 ket qua len 'zero_results' khi tu khoa nay truoc day CO ket qua.
    const finalStatus = await finishRun(db, runId, source.id, keyword, {
      status,
      itemsFound: collected.length,
      pagesFetched,
      errorText,
    })

    // Cache CHI khi lan crawl thanh cong tron ven. Cache mot lan 'partial' se
    // khien suot 6h sau moi tim kiem tra danh sach thieu qua nhanh cached, mat
    // sach tin hieu canh bao. Cache mot lan 'zero_results' con te hon: do la
    // dau hieu adapter HONG, ma nguoi dung se thay "khong tim thay mon nao"
    // trong im lang suot 6 tieng.
    // Nguoc lai, ket qua 0 mon THAT SU (tu khoa chua tung co hang) van phai
    // duoc cache, neu khong moi lan tim lai deu crawl lai va dot ngan sach.
    if (finalStatus === 'ok') {
      const expiresAt = new Date(Date.now() + ttlHours * 3600_000)
      await db
        .insert(keywordCache)
        .values({ keyword, sourceId: source.id, expiresAt })
        .onConflictDoUpdate({
          target: [keywordCache.keyword, keywordCache.sourceId],
          set: { fetchedAt: new Date(), expiresAt },
        })
    }

    results.push({
      sourceId: source.id,
      status: finalStatus,
      itemsFound: collected.length,
      pagesFetched,
      errorText,
    })
  }

  return results
}

