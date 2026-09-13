import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { InvaluableParseError, parseInvaluableResponse } from './parse'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(readFileSync(join(here, 'fixtures/search-tiffany-lamp.json'), 'utf8'))

describe('parseInvaluableResponse — contract', () => {
  const page = parseInvaluableResponse(fixture)

  it('doc duoc ket qua tu phan hoi Algolia', () => {
    expect(page.listings.length).toBeGreaterThan(0)
  })

  it('moi listing co du field bat buoc va dung kieu', () => {
    for (const l of page.listings) {
      expect(l.sourceListingId.length).toBeGreaterThan(0)
      expect(l.title.length).toBeGreaterThan(0)
      expect(l.url).toMatch(/^https:\/\/www\.invaluable\.com\/auction-lot\/-/)
      expect(['estimate', 'current_bid', 'starting_bid', 'buy_now', 'sold', 'unknown']).toContain(
        l.priceKind,
      )
      expect(['active', 'ended', 'sold', 'withdrawn', 'stale']).toContain(l.status)
      if (l.endsAtUtc) expect(l.endsAtUtc.getFullYear()).toBeGreaterThan(2000)
    }
  })

  it('KHONG luu du lieu ca nhan cua nguoi dung Invaluable', () => {
    // `watched`/`watchedRefs` la danh sach ID nguoi dung dang theo doi lot.
    // Chung ta can du lieu mon hang, khong can biet ai dang xem gi.
    for (const l of page.listings) {
      const raw = l.raw as Record<string, unknown>
      expect(raw.watched).toBeUndefined()
      expect(raw.watchedRefs).toBeUndefined()
      expect(raw.bids).toBeUndefined()
      expect(raw.winner).toBeUndefined()
      expect(raw.winnerRef).toBeUndefined()
      // Va khong ro ri qua ban JSON serialize
      expect(JSON.stringify(raw)).not.toContain('watchedRefs')
    }
  })

  it('lay duoc tien te theo tung lot', () => {
    const withCurrency = page.listings.filter((l) => l.currency)
    expect(withCurrency.length).toBeGreaterThan(0)
    for (const l of withCurrency) expect(l.currency).toMatch(/^[A-Z]{3}$/)
  })

  it('lay duoc danh muc cua nguon', () => {
    const withCategory = page.listings.find((l) => l.sourceCategory)
    expect(withCategory?.sourceCategory).toContain('/')
  })

  it('tach estimate khoi gia song', () => {
    const withBoth = page.listings.find(
      (l) => l.estimateLow !== undefined && l.priceKind !== 'estimate',
    )
    if (withBoth) expect(withBoth.priceAmount).not.toBe(withBoth.estimateLow)
  })

  it('gan duoc nha dau gia', () => {
    const withHouse = page.listings.find((l) => l.auction?.house)
    expect(withHouse?.auction?.house?.name.length).toBeGreaterThan(0)
  })

  it('bao loi khi Algolia tu choi', () => {
    expect(() => parseInvaluableResponse({ message: 'Invalid API key', status: 403 })).toThrow(
      InvaluableParseError,
    )
  })

  it('TRANG 1 thieu hits phai nem loi, khong duoc coi la het hang', () => {
    expect(() => parseInvaluableResponse({}, 1)).toThrow(InvaluableParseError)
  })

  it('TRANG 2 thieu hits la het trang', () => {
    const result = parseInvaluableResponse({}, 2)
    expect(result.listings).toEqual([])
    expect(result.isLastPage).toBe(true)
  })
})
