'use client'

import { COMMON_CURRENCIES } from '@bid/db/currency'
import { getDictionary, type Locale } from '../i18n'

/**
 * Chọn tiền tệ để SO SÁNH. Giá gốc luôn được giữ nguyên và hiện song song —
 * vì đó mới là số tiền thực sự phải trả.
 */
export function CurrencyPicker({ value, locale }: { value: string | null; locale: Locale }) {
  const t = getDictionary(locale)

  return (
    <form action="/api/preferences/currency" method="post" style={{ display: 'inline-flex' }}>
      <select
        name="currency"
        defaultValue={value ?? ''}
        onChange={(e) => {
          // Chỉ ghi khi CHÍNH NGƯỜI DÙNG đổi. Trình duyệt tự khôi phục giá trị
          // form sau khi tải lại trang, và React re-render cũng sinh `change` —
          // nếu nhận hết thì một lựa chọn cũ sẽ âm thầm ghi đè lựa chọn thật.
          if (!e.nativeEvent.isTrusted) return
          if (e.currentTarget.value === (value ?? '')) return
          e.currentTarget.form?.requestSubmit()
        }}
        aria-label={t.nav.currencyLabel}
        style={{ width: 'auto', padding: '6px 8px', fontSize: 13 }}
      >
        <option value="">{t.nav.keepOriginal}</option>
        {COMMON_CURRENCIES.map((c) => (
          <option key={c} value={c}>
            ≈ {c}
          </option>
        ))}
      </select>
    </form>
  )
}
