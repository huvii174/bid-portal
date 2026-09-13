'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { getDictionary, type Locale } from '../i18n'

export function SourceToggle({
  sourceId,
  enabled,
  locale,
}: {
  sourceId: string
  enabled: boolean
  locale: Locale
}) {
  const t = getDictionary(locale)
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function toggle() {
    setPending(true)
    await fetch('/api/admin/sources', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceId, enabled: !enabled }),
    })
    setPending(false)
    router.refresh()
  }

  return (
    <button onClick={toggle} disabled={pending}>
      {enabled ? t.admin.turnOff : t.admin.turnOn}
    </button>
  )
}
