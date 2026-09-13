import type { Adapter, SearchPage } from '../types'
import { HibidParseError, parseHibidSearchHtml } from './parse'
import { createPacer } from '../../rate-limit'

const BASE = 'https://hibid.com'

/**
 * UA that, kem email lien he — khong gia dang trinh duyet vo danh.
 * Doi sang domain that cua doi truoc khi chay production.
 */
const USER_AGENT =
  process.env.CRAWLER_USER_AGENT ??
  'BidPortal/0.1 (internal antique-auction aggregator; contact: ops@example.com)'

export class HibidFetchError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message)
  }
}

export function createHibidAdapter(minRequestIntervalMs = 2000): Adapter {
  const pace = createPacer(minRequestIntervalMs)

  return {
    id: 'hibid',

    async search(keyword: string, page: number): Promise<SearchPage> {
      const url = new URL('/lots', BASE)
      url.searchParams.set('q', keyword)
      if (page > 1) url.searchParams.set('apage', String(page))

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
          throw new HibidFetchError(`khong goi duoc HiBid: ${(err as Error).message}`)
        }

        if (!res.ok) {
          throw new HibidFetchError(`HiBid tra ve HTTP ${res.status}`, res.status)
        }

        return parseHibidSearchHtml(await res.text(), page)
      }

      try {
        return await fetchOnce()
      } catch (err) {
        // HiBid thinh thoang tra ve trang khong co lotSearch mot cach ngau
        // nhien. Thu lai mot lan de mot truc trac thoang qua khong bien thanh
        // "0 ket qua"; van that bai that neu no lap lai.
        if (err instanceof HibidParseError) return fetchOnce()
        throw err
      }
    },
  }
}
