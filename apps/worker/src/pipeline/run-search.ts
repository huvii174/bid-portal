import { eq } from 'drizzle-orm'
import { keywordCache, sources, type Db } from '@bid/db'
import { createHibidAdapter } from '../adapters/hibid/index'
import { createLiveAuctioneersAdapter } from '../adapters/liveauctioneers/index'
import { createInvaluableAdapter } from '../adapters/invaluable/index'
import type { Adapter, RawListing } from '../adapters/types'
import { getNumericSetting } from '../rate-limit'
import { finishRun, startRun } from './health'
import { markMissing, upsertListings } from './upsert'
import type { AdapterRunStatus } from '@bid/db/schema'

// Adapter giu pacer ben trong, nen phai dung chung mot the hien cho ca tien
// trinh. Tao moi theo tung job se reset giãn cach, va hai job lien tiep se ban
// vao nguon khong cach nhau chut nao.
const adapters = new Map<string, Adapter>()

function adapterFor(sourceId: string, minIntervalMs: number): Adapter | null {
  const existing = adapters.get(sourceId)
  if (existing) return existing

  const factory: Record<string, (ms: number) => Adapter> = {
    hibid: createHibidAdapter,
    liveauctioneers: createLiveAuctioneersAdapter,
    invaluable: createInvaluableAdapter,
  }

  const create = factory[sourceId]
  if (!create) return null

  const adapter = create(minIntervalMs)
  adapters.set(sourceId, adapter)
  return adapter
}

export interface SourceResult {
  sourceId: string
  status: AdapterRunStatus | 'disabled'
  itemsFound: number
  pagesFetched: number
  /** Het so trang cho phep nhung nguon van con hang. */
  truncated: boolean
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
      results.push({
        sourceId: source.id,
        status: 'disabled',
        itemsFound: 0,
        pagesFetched: 0,
        truncated: false,
      })
      continue
    }

    const adapter = adapterFor(source.id, source.minRequestIntervalMs)
    if (!adapter) {
      results.push({
        sourceId: source.id,
        status: 'error',
        itemsFound: 0,
        pagesFetched: 0,
        truncated: false,
        errorText: 'chua co adapter cho nguon nay',
      })
      continue
    }

    const runId = await startRun(db, source.id, keyword, searchJobId)
    const collected: RawListing[] = []
    let pagesFetched = 0
    let status: AdapterRunStatus = 'ok'
    let errorText: string | undefined
    let reachedEnd = false

    try {
      for (let page = 1; page <= pagesPerSearch; page++) {
        const result = await adapter.search(keyword, page)
        pagesFetched += result.httpRequests
        collected.push(...result.listings)
        if (result.isLastPage) {
          reachedEnd = true
          break
        }
      }
    } catch (err) {
      status = 'error'
      errorText = (err as Error).message
    }

    if (collected.length > 0) {
      const { listingIds } = await upsertListings(db, source.id, keyword, collected)
      await markMissing(db, source.id, keyword, listingIds)
    }

    // Chay het pagesPerSearch ma nguon VAN con hang = ket qua bi cat. Truoc
    // day truong hop nay bao 'xong' nhu binh thuong, dung kieu thu thap thieu
    // am tham ma OPERATIONS.md phai bu bang dem tay hang thang — trong khi
    // vong lap giu san dung bien can thiet.
    const truncated = status === 'ok' && !reachedEnd
    if (truncated) {
      errorText = `cat bot o ${pagesPerSearch} trang — nguon van con hang`
    }

    // finishRun phai chay TRUOC khi quyet dinh cache: chinh no moi nang mot lan
    // chay 0 ket qua len 'zero_results' khi tu khoa nay truoc day CO ket qua.
    const finalStatus = await finishRun(db, runId, source.id, keyword, {
      status,
      itemsFound: collected.length,
      pagesFetched,
      truncated,
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
      truncated,
      errorText,
    })
  }

  return results
}

