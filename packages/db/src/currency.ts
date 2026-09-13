/**
 * Nhà đấu giá tự gõ mã tiền tệ nên dữ liệu thật có rác: HiBid trả về cả
 * "CDN", "Can", "CAN" — đều là đô la Canada. Không chuẩn hoá thì quy đổi sẽ
 * âm thầm bỏ qua những món đó, hoặc tệ hơn, quy đổi sai.
 */
const ALIASES: Record<string, string> = {
  CDN: 'CAD',
  CAN: 'CAD',
  'C$': 'CAD',
  US: 'USD',
  'US$': 'USD',
  USDOLLAR: 'USD',
  STG: 'GBP',
  UKP: 'GBP',
  'A$': 'AUD',
  AUS: 'AUD',
  EURO: 'EUR',
  RMB: 'CNY',
}

export function normalizeCurrency(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = raw.trim().toUpperCase()
  if (!cleaned) return null

  const aliased = ALIASES[cleaned]
  if (aliased) return aliased

  // Chi chap nhan ma ISO 3 chu; con lai tra null thay vi doan bua.
  return /^[A-Z]{3}$/.test(cleaned) ? cleaned : null
}

export interface ConvertInput {
  amount: number
  from: string
  to: string
  /** Bao nhieu don vi tien do doi duoc 1 USD. */
  perUsd: Record<string, number>
}

/**
 * Tra ve null khi thieu ty gia — KHONG bao gio doan. Hien gia goc con hon
 * hien mot con so quy doi sai cho nguoi dang can quyet dinh tra bao nhieu.
 */
export function convertCurrency({ amount, from, to, perUsd }: ConvertInput): number | null {
  if (!Number.isFinite(amount)) return null
  if (from === to) return amount

  const fromRate = perUsd[from]
  const toRate = perUsd[to]
  if (!fromRate || !toRate || fromRate <= 0 || toRate <= 0) return null

  return (amount / fromRate) * toRate
}

/** Cac tien te hay gap nhat trong du lieu dau gia, dua len dau danh sach chon. */
export const COMMON_CURRENCIES = [
  'USD',
  'VND',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'CHF',
  'JPY',
  'CNY',
  'SGD',
] as const
