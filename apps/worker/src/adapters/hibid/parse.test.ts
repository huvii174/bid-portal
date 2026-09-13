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

  it('doc dung dinh dang chau Au (dau phay la thap phan)', () => {
    // Truoc khi sua: "1.500,00 EUR" bi doc thanh 1,5 va 0.
    const r = parseEstimate('1.500,00 - 2.750,50 EUR')
    expect(r?.low).toBe(1500)
    expect(r?.high).toBe(2750.5)
    expect(r?.currency).toBe('EUR')
  })

  it('van doc dung dinh dang Anh-My', () => {
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
  })

  it('trang day 100 lot chua phai trang cuoi', () => {
    expect(page.isLastPage).toBe(false)
  })

  it('mot lot bi bo qua tren trang day KHONG lam tuong nham la trang cuoi', () => {
    // isLastPage phai so voi so ref tho. Neu so voi mang da loc thi chi can
    // mot lot hong (thieu id/lead) la 99 < 100 -> khong bao gio lay trang 2.
    const broken = fixture.replace(/"lead":"[^"]*"/, '"lead":""')
    const result = parseHibidSearchHtml(broken)
    expect(result.listings.length).toBeLessThan(100)
    expect(result.isLastPage).toBe(false)
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

  it('trang vuot qua ket qua cuoi la het trang, KHONG phai loi', () => {
    // HiBid render trang nay khong kem lotSearch. Neu coi day la loi thi moi
    // tim kiem mot trang deu bao dong gia, va doi se hoc cach phot lo canh bao.
    const beyondLast = '<script id="hibid-state">{"apollo.state":{"ROOT_QUERY":{"__typename":"Query"}}}</script>'
    const result = parseHibidSearchHtml(beyondLast)
    expect(result.listings).toEqual([])
    expect(result.isLastPage).toBe(true)
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
