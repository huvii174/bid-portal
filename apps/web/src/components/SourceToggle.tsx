'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SourceToggle({ sourceId, enabled }: { sourceId: string; enabled: boolean }) {
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
      {enabled ? 'Tắt nguồn' : 'Bật lại'}
    </button>
  )
}
