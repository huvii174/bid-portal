'use client'

import { getDictionary, LOCALES, type Locale } from '../i18n'

export function LocalePicker({ value }: { value: Locale }) {
  return (
    <form action="/api/preferences/locale" method="post" style={{ display: 'inline-flex' }}>
      <select
        name="locale"
        defaultValue={value}
        onChange={(e) => {
          // Chi ghi khi chinh nguoi dung doi — trinh duyet tu khoi phuc gia tri
          // form sau khi tai lai trang cung sinh `change`.
          if (!e.nativeEvent.isTrusted) return
          if (e.currentTarget.value === value) return
          e.currentTarget.form?.requestSubmit()
        }}
        aria-label={getDictionary(value).nav.languageLabel}
        style={{ width: 'auto', padding: '6px 8px', fontSize: 13 }}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {getDictionary(l).label}
          </option>
        ))}
      </select>
    </form>
  )
}
