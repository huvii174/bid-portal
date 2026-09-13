import { describe, expect, it } from 'vitest'
import { en } from './en'
import { vi } from './vi'
import { DEFAULT_LOCALE, getDictionary, isLocale, LOCALES } from './index'

type Plain = Record<string, unknown>

/** Đường dẫn tới mọi khoá lá, để so sánh hai từ điển theo cấu trúc. */
function leafPaths(obj: Plain, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    return v && typeof v === 'object' && !Array.isArray(v)
      ? leafPaths(v as Plain, path)
      : [path]
  })
}

describe('i18n', () => {
  it('English is the default', () => {
    expect(DEFAULT_LOCALE).toBe('en')
    expect(getDictionary(null)).toBe(en)
    expect(getDictionary(undefined)).toBe(en)
  })

  it('a translation has EXACTLY the same key set as the source', () => {
    // Kiem tra o muc du lieu chu khong chi muc kieu: thieu mot khoa la giao
    // dien se hien `undefined` cho nguoi dung.
    expect(leafPaths(vi as unknown as Plain).sort()).toEqual(leafPaths(en as unknown as Plain).sort())
  })

  it('a key that is a function must stay a function in every translation', () => {
    for (const path of leafPaths(en as unknown as Plain)) {
      const get = (o: Plain) => path.split('.').reduce<unknown>((acc, k) => (acc as Plain)?.[k], o)
      expect(typeof get(vi as unknown as Plain), path).toBe(typeof get(en as unknown as Plain))
    }
  })

  it('no empty strings', () => {
    for (const locale of LOCALES) {
      const dict = getDictionary(locale) as unknown as Plain
      for (const path of leafPaths(dict)) {
        const value = path.split('.').reduce<unknown>((acc, k) => (acc as Plain)?.[k], dict)
        if (typeof value === 'string') expect(value.trim(), `${locale}.${path}`).not.toBe('')
      }
    }
  })

  it('each locale carries its own formatLocale and htmlLang', () => {
    expect(en.formatLocale).toBe('en-US')
    expect(vi.formatLocale).toBe('vi-VN')
    expect(en.htmlLang).toBe('en')
    expect(vi.htmlLang).toBe('vi')
  })

  it('isLocale rejects unknown values', () => {
    expect(isLocale('en')).toBe(true)
    expect(isLocale('vi')).toBe(true)
    expect(isLocale('fr')).toBe(false)
    expect(isLocale('')).toBe(false)
    expect(isLocale(null)).toBe(false)
  })

  it('an unsupported locale falls back to the default', () => {
    expect(getDictionary('fr' as never)).toBe(en)
  })

  it('English pluralisation is correct', () => {
    expect(en.card.daysLeft(1)).toBe('1 day left')
    expect(en.card.daysLeft(3)).toBe('3 days left')
    expect(en.search.itemCount(1)).toBe('1 lot')
    expect(en.search.itemCount(5)).toBe('5 lots')
  })
})
