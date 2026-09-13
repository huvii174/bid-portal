import { describe, expect, it } from 'vitest'
import { convertCurrency, normalizeCurrency } from './currency'

describe('normalizeCurrency', () => {
  it('sua cac ma rac that gap trong du lieu HiBid', () => {
    // Nha dau gia tu go nen du lieu that co ca ba bien the nay cho do Canada.
    expect(normalizeCurrency('CDN')).toBe('CAD')
    expect(normalizeCurrency('Can')).toBe('CAD')
    expect(normalizeCurrency('CAN')).toBe('CAD')
  })

  it('giu nguyen ma ISO hop le va viet hoa', () => {
    expect(normalizeCurrency('usd')).toBe('USD')
    expect(normalizeCurrency(' eur ')).toBe('EUR')
  })

  it('tra null thay vi doan khi ma khong hop le', () => {
    expect(normalizeCurrency('dollars')).toBeNull()
    expect(normalizeCurrency('12')).toBeNull()
    expect(normalizeCurrency('')).toBeNull()
    expect(normalizeCurrency(null)).toBeNull()
    expect(normalizeCurrency(undefined)).toBeNull()
  })
})

describe('convertCurrency', () => {
  const perUsd = { USD: 1, VND: 25876.38, EUR: 0.8618, CAD: 1.3858 }

  it('quy doi qua USD lam trung gian', () => {
    const r = convertCurrency({ amount: 100, from: 'USD', to: 'VND', perUsd })
    expect(r).toBeCloseTo(2587638, 0)
  })

  it('quy doi giua hai tien khong phai USD', () => {
    const r = convertCurrency({ amount: 100, from: 'EUR', to: 'CAD', perUsd })
    expect(r).toBeCloseTo((100 / 0.8618) * 1.3858, 4)
  })

  it('cung tien te thi tra nguyen so', () => {
    expect(convertCurrency({ amount: 42, from: 'USD', to: 'USD', perUsd })).toBe(42)
  })

  it('THIEU TY GIA thi tra null, khong bao gio doan', () => {
    // Hien mot con so quy doi sai cho nguoi dang quyet dinh tra bao nhieu
    // con te hon la khong hien gi.
    expect(convertCurrency({ amount: 100, from: 'CZK', to: 'USD', perUsd })).toBeNull()
    expect(convertCurrency({ amount: 100, from: 'USD', to: 'XYZ', perUsd })).toBeNull()
  })

  it('tu choi so khong hop le', () => {
    expect(convertCurrency({ amount: Number.NaN, from: 'USD', to: 'VND', perUsd })).toBeNull()
  })

  it('tu choi ty gia <= 0', () => {
    expect(convertCurrency({ amount: 100, from: 'USD', to: 'BAD', perUsd: { USD: 1, BAD: 0 } })).toBeNull()
  })
})
