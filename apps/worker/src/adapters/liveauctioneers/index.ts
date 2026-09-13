import type { Adapter, SearchPage } from '../types'
import { LiveAuctioneersParseError, parseLiveAuctioneersSearchHtml } from './parse'
import { createPacer } from '../../rate-limit'

const BASE = 'https://www.liveauctioneers.com'

const USER_AGENT =
  process.env.CRAWLER_USER_AGENT ??
  'BidPortal/0.1 (internal antique-auction aggregator; contact: ops@example.com)'

export class LiveAuctioneersFetchError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message)
  }
}

export function createLiveAuctioneersAdapter(minRequestIntervalMs = 5000): Adapter {
  const pace = createPacer(minRequestIntervalMs)

  return {
    id: 'liveauctioneers',

    async search(keyword: string, page: number): Promise<SearchPage> {
      const url = new URL('/search/', BASE)
      url.searchParams.set('keyword', keyword)
      if (page > 1) url.searchParams.set('page', String(page))

      const fetchOnce = async (): Promise<SearchPage> => {
        await pace()

        let res: Response
        try {
          res = await fetch(url, {
            headers: {
              'user-agent': USER_AGENT,
              accept: 'text/html,application/xhtml+xml',
              'accept-language': 'en-US,en;q=0.9',
            },
            signal: AbortSignal.timeout(30_000),
          })
        } catch (err) {
          throw new LiveAuctioneersFetchError(
            `khong goi duoc LiveAuctioneers: ${(err as Error).message}`,
          )
        }

        if (!res.ok) {
          throw new LiveAuctioneersFetchError(
            `LiveAuctioneers tra ve HTTP ${res.status}`,
            res.status,
          )
        }

        return parseLiveAuctioneersSearchHtml(await res.text(), page)
      }

      try {
        return await fetchOnce()
      } catch (err) {
        // Thu lai mot lan de mot truc trac thoang qua khong bien thanh "0 ket qua".
        if (!(err instanceof LiveAuctioneersParseError)) throw err
        const retried = await fetchOnce()
        return { ...retried, httpRequests: retried.httpRequests + 1 }
      }
    },
  }
}
