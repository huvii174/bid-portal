import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HibidParseError, parseEstimate, parseHibidSearchHtml, slugify } from './parse'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = readFileSync(join(here, 'fixtures/search-tiffany-lamp.html'), 'utf8')

describe('parseEstimate', () => {
  it('doc khoang uoc tinh co dau phay va tien te', () => {
    expect(parseEstimate('2,000.00 - 4,000.00 USD')).toEqual({
      low: 2000,
      high: 4000,
      currency: 'USD',
      raw: '2,000.00 - 4,000.00 USD',
    })
  })

  it('mot gia tri don coi low = high', () => {
    const r = parseEstimate('1,500.00 USD')
    expect(r?.low).toBe(1500)
    expect(r?.high).toBe(1500)
  })

  it('giu nguyen van khi khong parse duoc so', () => {
    const r = parseEstimate('No estimate')
    expect(r?.raw).toBe('No estimate')
    expect(r?.low).toBeUndefined()
  })

  it('bo qua chuoi rong va gia tri khong phai chuoi', () => {
    expect(parseEstimate('')).toBeUndefined()
    expect(parseEstimate('   ')).toBeUndefined()
    expect(parseEstimate(null)).toBeUndefined()
    expect(parseEstimate(42)).toBeUndefined()
  })
})

describe('slugify', () => {
  it('dung dinh dang url cua HiBid', () => {
    expect(slugify('Tiffany Studios Aladdin Floor Lamp, ca. 1910')).toBe(
      'tiffany-studios-aladdin-floor-lamp-ca-1910',
    )
  })
})

describe('parseHibidSearchHtml — contract', () => {
  const page = parseHibidSearchHtml(fixture)

  it('lay duoc dung so lot cua mot trang', () => {
    expect(page.listings.length).toBe(100)
    expect(page.pageLength).toBe(100)
  })

  it('moi listing co du field bat buoc va dung kieu', () => {
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

  it('giu nguyen thu tu xep hang cua nguon', () => {
    expect(page.listings[0]?.sourceListingId).toBe('316125846')
  })

  it('tach estimate ra khoi gia song, khong tron vao nhau', () => {
    const withBoth = page.listings.find(
      (l) => l.estimateLow !== undefined && l.priceKind !== 'estimate',
    )
    expect(withBoth).toBeDefined()
    // estimate van con nguyen ven du gia hien thi la gia song
    expect(withBoth!.estimateLow).toBeGreaterThan(0)
    expect(withBoth!.priceAmount).not.toBe(withBoth!.estimateLow)
  })

  it('gan duoc auction va nha dau gia', () => {
    const withAuction = page.listings.find((l) => l.auction?.house)
    expect(withAuction?.auction?.sourceAuctionId).toMatch(/^\d+$/)
    expect(withAuction?.auction?.house?.name.length).toBeGreaterThan(0)
  })

  it('lay thumbnail co gioi han 400px theo quy tac cua plan', () => {
    const withThumb = page.listings.find((l) => l.thumbUrl)
    expect(withThumb?.thumbUrl).toContain('cdn.hibid.com')
    expect(withThumb?.thumbUrl).toMatch(/[?&]h=400&w=400/)
  })

  it('danh dau gio ket thuc la xap xi voi phien live', () => {
    const live = page.listings.find((l) => l.auction?.format === 'live')
    if (live) expect(live.endTimeIsApproximate).toBe(true)
  })

  it('bao loi ro rang khi HiBid bo TransferState', () => {
    expect(() => parseHibidSearchHtml('<html><body>khong co state</body></html>')).toThrow(
      HibidParseError,
    )
  })

  it('bao loi ro rang khi state khong phai JSON', () => {
    expect(() =>
      parseHibidSearchHtml('<script id="hibid-state">{khong-phai-json</script>'),
    ).toThrow(HibidParseError)
  })
})
