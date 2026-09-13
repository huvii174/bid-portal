import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  HibidParseError,
  parseAmount,
  parseEstimate,
  parseHibidSearchHtml,
  slugify,
} from './parse'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = readFileSync(join(here, 'fixtures/search-tiffany-lamp.html'), 'utf8')

describe('parseEstimate', () => {
  it('reads an estimate range with thousands separators and a currency', () => {
    expect(parseEstimate('2,000.00 - 4,000.00 USD')).toEqual({
      low: 2000,
      high: 4000,
      currency: 'USD',
      raw: '2,000.00 - 4,000.00 USD',
    })
  })

  it('a single value collapses to low = high', () => {
    const r = parseEstimate('1,500.00 USD')
    expect(r?.low).toBe(1500)
    expect(r?.high).toBe(1500)
  })

  it('keeps the raw text when no number can be parsed', () => {
    const r = parseEstimate('No estimate')
    expect(r?.raw).toBe('No estimate')
    expect(r?.low).toBeUndefined()
  })

  it('ignores empty strings and non-string values', () => {
    expect(parseEstimate('')).toBeUndefined()
    expect(parseEstimate('   ')).toBeUndefined()
    expect(parseEstimate(null)).toBeUndefined()
    expect(parseEstimate(42)).toBeUndefined()
  })

  it('reads European format where comma is the decimal separator', () => {
    // Truoc khi sua: "1.500,00 EUR" bi doc thanh 1,5 va 0.
    const r = parseEstimate('1.500,00 - 2.750,50 EUR')
    expect(r?.low).toBe(1500)
    expect(r?.high).toBe(2750.5)
    expect(r?.currency).toBe('EUR')
  })

  it('still reads Anglo-American format correctly', () => {
    const r = parseEstimate('2,000.00 - 4,000.00 USD')
    expect(r?.low).toBe(2000)
    expect(r?.high).toBe(4000)
  })
})

describe('parseAmount', () => {
  it.each([
    ['2,000.00', 2000],
    ['1.500,00', 1500],
    ['950', 950],
    ['1,125.75', 1125.75],
    ['1.125,75', 1125.75],
  ])('%s -> %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected)
  })
})

describe('slugify', () => {
  it('matches the URL slug format HiBid uses', () => {
    expect(slugify('Tiffany Studios Aladdin Floor Lamp, ca. 1910')).toBe(
      'tiffany-studios-aladdin-floor-lamp-ca-1910',
    )
  })
})

describe('parseHibidSearchHtml — contract', () => {
  const page = parseHibidSearchHtml(fixture)

  it('extracts the full page of lots', () => {
    expect(page.listings.length).toBe(100)
  })

  it('a full 100-lot page is not the last page', () => {
    expect(page.isLastPage).toBe(false)
  })

  it('one skipped lot on a full page does NOT look like the last page', () => {
    // isLastPage phai so voi so ref tho. Neu so voi mang da loc thi chi can
    // mot lot hong (thieu id/lead) la 99 < 100 -> khong bao gio lay trang 2.
    const broken = fixture.replace(/"lead":"[^"]*"/, '"lead":""')
    const result = parseHibidSearchHtml(broken)
    expect(result.listings.length).toBeLessThan(100)
    expect(result.isLastPage).toBe(false)
  })

  it('every listing has the required fields with the right types', () => {
    for (const l of page.listings) {
      expect(typeof l.sourceListingId).toBe('string')
      expect(l.sourceListingId.length).toBeGreaterThan(0)
      expect(typeof l.title).toBe('string')
      expect(l.title.length).toBeGreaterThan(0)
      expect(l.url).toMatch(/^https:\/\/hibid\.com\/lot\/\d+\//)
      expect(['estimate', 'current_bid', 'starting_bid', 'buy_now', 'sold', 'unknown']).toContain(
        l.priceKind,
      )
      expect(['active', 'ended', 'sold', 'withdrawn', 'stale']).toContain(l.status)
      expect(typeof l.endTimeIsApproximate).toBe('boolean')
      if (l.priceAmount !== undefined) expect(Number.isFinite(l.priceAmount)).toBe(true)
      if (l.endsAtUtc) expect(l.endsAtUtc instanceof Date).toBe(true)
    }
  })

  it('preserves the ranking order the source returned', () => {
    expect(page.listings[0]?.sourceListingId).toBe('316125846')
  })

  it('keeps the estimate separate from the live price', () => {
    const withBoth = page.listings.find(
      (l) => l.estimateLow !== undefined && l.priceKind !== 'estimate',
    )
    expect(withBoth).toBeDefined()
    // estimate van con nguyen ven du gia hien thi la gia song
    expect(withBoth!.estimateLow).toBeGreaterThan(0)
    expect(withBoth!.priceAmount).not.toBe(withBoth!.estimateLow)
  })

  it('links the auction and the auction house', () => {
    const withAuction = page.listings.find((l) => l.auction?.house)
    expect(withAuction?.auction?.sourceAuctionId).toMatch(/^\d+$/)
    expect(withAuction?.auction?.house?.name.length).toBeGreaterThan(0)
  })

  it('takes the 400px thumbnail the plan requires', () => {
    const withThumb = page.listings.find((l) => l.thumbUrl)
    expect(withThumb?.thumbUrl).toContain('cdn.hibid.com')
    expect(withThumb?.thumbUrl).toMatch(/[?&]h=400&w=400/)
  })

  it('marks the closing time approximate for live sales', () => {
    const live = page.listings.find((l) => l.auction?.format === 'live')
    if (live) expect(live.endTimeIsApproximate).toBe(true)
  })

  const noSearchNode =
    '<script id="hibid-state">{"apollo.state":{"ROOT_QUERY":{"__typename":"Query"}}}</script>'

  it('PAGE 2 without lotSearch is the end of results, NOT an error', () => {
    // Neu coi day la loi thi moi tim kiem mot trang deu bao dong gia, va doi
    // se hoc cach phot lo canh bao.
    const result = parseHibidSearchHtml(noSearchNode, 2)
    expect(result.listings).toEqual([])
    expect(result.isLastPage).toBe(true)
  })

  it('PAGE 1 without lotSearch must THROW, never be read as the end of results', () => {
    // HiBid thinh thoang tra ve trang bat thuong nay. Coi no la "het hang" se
    // ghi 0 ket qua trong im lang cho tu khoa dang co 100 mon — dung kieu thu
    // thap thieu am tham ma he thong canh bao sinh ra de chan.
    expect(() => parseHibidSearchHtml(noSearchNode, 1)).toThrow(HibidParseError)
  })

  it('reports clearly when HiBid drops its TransferState', () => {
    expect(() => parseHibidSearchHtml('<html><body>khong co state</body></html>')).toThrow(
      HibidParseError,
    )
  })

  it('reports clearly when the state is not JSON', () => {
    expect(() =>
      parseHibidSearchHtml('<script id="hibid-state">{khong-phai-json</script>'),
    ).toThrow(HibidParseError)
  })
})
