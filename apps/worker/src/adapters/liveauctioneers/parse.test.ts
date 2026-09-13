import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LiveAuctioneersParseError, parseLiveAuctioneersSearchHtml } from './parse'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = readFileSync(join(here, 'fixtures/search-tiffany-lamp.html'), 'utf8')

describe('parseLiveAuctioneersSearchHtml — contract', () => {
  const page = parseLiveAuctioneersSearchHtml(fixture)

  it('reads results out of window.__data', () => {
    expect(page.listings.length).toBeGreaterThan(0)
  })

  it('every listing has the required fields with the right types', () => {
    for (const l of page.listings) {
      expect(l.sourceListingId).toMatch(/^\d+$/)
      expect(l.title.length).toBeGreaterThan(0)
      expect(l.url).toMatch(/^https:\/\/www\.liveauctioneers\.com\/item\/\d+/)
      expect(['estimate', 'current_bid', 'starting_bid', 'buy_now', 'sold', 'unknown']).toContain(
        l.priceKind,
      )
      expect(['active', 'ended', 'sold', 'withdrawn', 'stale']).toContain(l.status)
      expect(typeof l.endTimeIsApproximate).toBe('boolean')
      if (l.priceAmount !== undefined) expect(Number.isFinite(l.priceAmount)).toBe(true)
      if (l.endsAtUtc) expect(l.endsAtUtc.getFullYear()).toBeGreaterThan(2000)
    }
  })

  it('preserves the ranking order the source returned', () => {
    const ids = page.listings.map((l) => l.sourceListingId)
    expect(ids[0]).toBe('240168726')
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('picks up the per-lot currency', () => {
    const withCurrency = page.listings.filter((l) => l.currency)
    expect(withCurrency.length).toBeGreaterThan(0)
    for (const l of withCurrency) expect(l.currency).toMatch(/^[A-Z]{3}$/)
  })

  it('keeps the estimate separate from the live price', () => {
    const withBoth = page.listings.find(
      (l) => l.estimateLow !== undefined && l.priceKind !== 'estimate',
    )
    expect(withBoth).toBeDefined()
    expect(withBoth!.estimateLow).toBeGreaterThan(0)
  })

  it('links the auction house', () => {
    const withHouse = page.listings.find((l) => l.auction?.house)
    expect(withHouse?.auction?.house?.name.length).toBeGreaterThan(0)
  })

  it('marks the closing time approximate for live sales', () => {
    const live = page.listings.find((l) => l.auction?.format === 'live')
    if (live) expect(live.endTimeIsApproximate).toBe(true)
  })

  it('does NOT read unix 0 as the year 1970', () => {
    for (const l of page.listings) {
      if (l.endsAtUtc) expect(l.endsAtUtc.getFullYear()).toBeGreaterThan(2000)
    }
  })

  it('PAGE 1 without itemIds must throw, never be read as the end of results', () => {
    const empty = '<html><script>window.__data={"search":{},"itemSummary":{"byId":{}}};</script></html>'
    expect(() => parseLiveAuctioneersSearchHtml(empty, 1)).toThrow(LiveAuctioneersParseError)
  })

  it('PAGE 2 without itemIds is the end of results', () => {
    const empty = '<html><script>window.__data={"search":{},"itemSummary":{"byId":{}}};</script></html>'
    const result = parseLiveAuctioneersSearchHtml(empty, 2)
    expect(result.listings).toEqual([])
    expect(result.isLastPage).toBe(true)
  })

  it('reports clearly when window.__data is gone', () => {
    expect(() => parseLiveAuctioneersSearchHtml('<html>khong co gi</html>')).toThrow(
      LiveAuctioneersParseError,
    )
  })
})
