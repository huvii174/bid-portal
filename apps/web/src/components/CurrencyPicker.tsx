'use client'

import { COMMON_CURRENCIES } from '@bid/db/currency'

/**
 * Chon tien te de SO SANH. Gia goc luon duoc giu nguyen va hien song song —
 * vi do moi la so tien thuc su phai tra.
 */
export function CurrencyPicker({ value }: { value: string | null }) {
  return (
    <form action="/api/preferences/currency" method="post" style={{ display: 'inline-flex' }}>
      <select
        name="currency"
        defaultValue={value ?? ''}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Tiền tệ quy đổi"
        style={{ width: 'auto', padding: '6px 8px', fontSize: 13 }}
      >
        <option value="">Giữ tiền gốc</option>
        {COMMON_CURRENCIES.map((c) => (
          <option key={c} value={c}>
            ≈ {c}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" style={{ marginLeft: 6 }}>
          Đổi
        </button>
      </noscript>
    </form>
  )
}
