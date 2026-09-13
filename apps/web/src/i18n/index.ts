import { en, type Dictionary } from './en'
import { vi } from './vi'

export const LOCALES = ['en', 'vi'] as const
export type Locale = (typeof LOCALES)[number]

/** Tiếng Anh là mặc định để người dùng ngoài Việt Nam mở lên là đọc được ngay. */
export const DEFAULT_LOCALE: Locale = 'en'

const DICTIONARIES: Record<Locale, Dictionary> = { en, vi }

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/**
 * Từ điển chứa hàm (số nhiều, nội suy), mà hàm thì không truyền được qua props
 * từ server sang client. Nên chỉ chuỗi `locale` đi qua ranh giới đó, còn mỗi
 * phía tự gọi hàm này — module thuần, import được ở cả hai nơi.
 */
export function getDictionary(locale: Locale | null | undefined): Dictionary {
  return DICTIONARIES[locale ?? DEFAULT_LOCALE] ?? DICTIONARIES[DEFAULT_LOCALE]
}

export type { Dictionary }
