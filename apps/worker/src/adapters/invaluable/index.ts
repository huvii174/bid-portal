import type { Adapter, SearchPage } from '../types'
import { InvaluableParseError, parseInvaluableResponse } from './parse'
import { createPacer } from '../../rate-limit'

/**
 * Invaluable render ket qua phia client qua Algolia, nen adapter nay goi thang
 * Algolia bang cap khoa search-only ma trang cua ho nhung cong khai.
 *
 * DAY LA DUONG DE BI CAT NHAT trong ba nguon: khoa co the bi doi bat cu luc
 * nao, va no tieu vao han muc Algolia tra phi cua Invaluable. Giu tan suat
 * that thap va san sang tat nguon nay. Xem docs/OPERATIONS.md.
 */
const APP_ID = process.env.INVALUABLE_ALGOLIA_APP_ID ?? '0HJBNDV358'
const API_KEY = process.env.INVALUABLE_ALGOLIA_API_KEY ?? 'c72467a0649841b28a88222132bef0ea'
const INDEX = process.env.INVALUABLE_ALGOLIA_INDEX ?? 'upcoming_lots_prod'

/** Algolia dem trang tu 0; phan con lai cua he thong dem tu 1. */
const HITS_PER_PAGE = 40

export class InvaluableFetchError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message)
  }
}

export function createInvaluableAdapter(minRequestIntervalMs = 10_000): Adapter {
  const pace = createPacer(minRequestIntervalMs)

  return {
    id: 'invaluable',

    async search(keyword: string, page: number): Promise<SearchPage> {
      const url = `https://${APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/${INDEX}/query`
      const params = new URLSearchParams({
        query: keyword,
        hitsPerPage: String(HITS_PER_PAGE),
        page: String(Math.max(0, page - 1)),
      })

      const fetchOnce = async (): Promise<SearchPage> => {
        await pace()

        let res: Response
        try {
          res = await fetch(url, {
            method: 'POST',
            headers: {
              'X-Algolia-API-Key': API_KEY,
              'X-Algolia-Application-Id': APP_ID,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ params: params.toString() }),
            signal: AbortSignal.timeout(30_000),
          })
        } catch (err) {
          throw new InvaluableFetchError(`khong goi duoc Algolia: ${(err as Error).message}`)
        }

        if (!res.ok) {
          // 401/403 gan nhu chac chan la khoa da bi doi — thong bao ro de nguoi
          // truc biet phai tat nguon chu khong phai di sua parser.
          const hint =
            res.status === 401 || res.status === 403
              ? ' (khoa Algolia cua Invaluable co the da bi doi — tat nguon nay)'
              : ''
          throw new InvaluableFetchError(`Algolia tra ve HTTP ${res.status}${hint}`, res.status)
        }

        return parseInvaluableResponse(await res.json(), page)
      }

      try {
        return await fetchOnce()
      } catch (err) {
        if (!(err instanceof InvaluableParseError)) throw err
        const retried = await fetchOnce()
        return { ...retried, httpRequests: retried.httpRequests + 1 }
      }
    },
  }
}
