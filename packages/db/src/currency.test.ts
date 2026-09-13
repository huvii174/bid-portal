import { describe, expect, it } from 'vitest'
import { convertCurrency, normalizeCurrency } from './currency'

describe('normalizeCurrency', () => {
  it('fixes the junk codes that really appear in HiBid data', () => {
    // Nha dau gia tu go nen du lieu that co ca ba bien the nay cho do Canada.
    expect(normalizeCurrency('CDN')).toBe('CAD')
    expect(normalizeCurrency('Can')).toBe('CAD')
    expect(normalizeCurrency('CAN')).toBe('CAD')
  })

  it('keeps valid ISO codes and upper-cases them', () => {
    expect(normalizeCurrency('usd')).toBe('USD')
    expect(normalizeCurrency(' eur ')).toBe('EUR')
  })

  it('returns null instead of guessing at an invalid code', () => {
    expect(normalizeCurrency('dollars')).toBeNull()
    expect(normalizeCurrency('12')).toBeNull()
    expect(normalizeCurrency('')).toBeNull()
    expect(normalizeCurrency(null)).toBeNull()
    expect(normalizeCurrency(undefined)).toBeNull()
  })
})

describe('convertCurrency', () => {
  const perUsd = { USD: 1, VND: 25876.38, EUR: 0.8618, CAD: 1.3858 }

  it('converts through USD as the pivot', () => {
    const r = convertCurrency({ amount: 100, from: 'USD', to: 'VND', perUsd })
    expect(r).toBeCloseTo(2587638, 0)
  })

  it('converts between two non-USD currencies', () => {
    const r = convertCurrency({ amount: 100, from: 'EUR', to: 'CAD', perUsd })
    expect(r).toBeCloseTo((100 / 0.8618) * 1.3858, 4)
  })

  it('returns the amount unchanged for the same currency', () => {
    expect(convertCurrency({ amount: 42, from: 'USD', to: 'USD', perUsd })).toBe(42)
  })

  it('returns null when a RATE IS MISSING, never guesses', () => {
    // Hien mot con so quy doi sai cho nguoi dang quyet dinh tra bao nhieu
    // con te hon la khong hien gi.
    expect(convertCurrency({ amount: 100, from: 'CZK', to: 'USD', perUsd })).toBeNull()
    expect(convertCurrency({ amount: 100, from: 'USD', to: 'XYZ', perUsd })).toBeNull()
  })

  it('rejects a non-finite amount', () => {
    expect(convertCurrency({ amount: Number.NaN, from: 'USD', to: 'VND', perUsd })).toBeNull()
  })

  it('rejects a rate of zero or less', () => {
    expect(convertCurrency({ amount: 100, from: 'USD', to: 'BAD', perUsd: { USD: 1, BAD: 0 } })).toBeNull()
  })
})
