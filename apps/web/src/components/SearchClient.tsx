'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ListingCard, type FxProps, type ResultRow } from './ListingCard'
import { getDictionary, type Locale } from '../i18n'

interface SourceProgress {
  sourceId: string
  name: string
  status: string
  itemsFound: number
  pagesFetched: number
  truncated: boolean
  errorText: string | null
}


export function SearchClient({
  timezone,
  initialKeyword,
  fx,
  locale,
}: {
  timezone: string
  initialKeyword: string
  fx: FxProps
  locale: Locale
}) {
  const t = getDictionary(locale)
  const [keyword, setKeyword] = useState(initialKeyword)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<ResultRow[]>([])
  const [sourcesState, setSourcesState] = useState<SourceProgress[]>([])
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [])

  // Job co the ket thuc ma khong bao giờ hoan tat (worker chet). Khong co tran
  // nay thi UI quay mai voi nut Tim bi khoa vinh vien.
  const MAX_POLLS = 80 // ~2 phut o nhip 1.5s

  const poll = useCallback(async (jobId: string, attempt = 0) => {
    if (attempt >= MAX_POLLS) {
      setMessage(t.search.pollTimeout)
      setBusy(false)
      return
    }

    const res = await fetch(`/api/search/${jobId}`)
    if (!res.ok) {
      setMessage(t.search.progressFailed)
      setBusy(false)
      return
    }

    const data = await res.json()
    setSourcesState(data.sources ?? [])

    if (!data.finished) {
      pollTimer.current = setTimeout(() => void poll(jobId, attempt + 1), 1500)
      return
    }

    setResults(data.results ?? [])
    setLastCheckedAt(data.lastCheckedAt ?? null)
    setBusy(false)

    if (data.status === 'failed') setMessage(t.search.allSourcesFailed)
    else if (data.status === 'partial') setMessage(t.search.someSourcesFailed)
    else setMessage(null)
  }, [t])

  const run = useCallback(
    async (raw: string) => {
      const q = raw.trim()
      if (!q || busy) return

      setBusy(true)
      setSearched(true)
      setMessage(null)
      setResults([])
      setSourcesState([])
      setLastCheckedAt(null)

      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keyword: q }),
      })

      if (!res.ok) {
        setMessage(t.search.requestFailed)
        setBusy(false)
        return
      }

      const data = await res.json()
      if (data.mode === 'cached') {
        setResults(data.results ?? [])
        setLastCheckedAt(data.lastCheckedAt ?? null)
        // Cache sinh ra tu mot lan crawl bi cat van phai noi ro, neu khong thi
        // suot 6h sau do danh sach ngan trong nhu danh sach day.
        if (data.truncatedSources?.length > 0) {
          setMessage(t.search.truncatedCached)
        }
        setBusy(false)
        return
      }

      void poll(data.jobId)
    },
    [busy, poll, t],
  )

  // /search?q=... phai tu chay — link tim kiem can chia se duoc.
  const autoRan = useRef(false)
  useEffect(() => {
    if (autoRan.current || !initialKeyword.trim()) return
    autoRan.current = true
    void run(initialKeyword)
  }, [initialKeyword, run])

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      void run(keyword)
    },
    [keyword, run],
  )

  return (
    <>
      <form onSubmit={submit} style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={t.search.placeholder}
          aria-label={t.search.inputLabel}
        />
        <button className="primary" type="submit" disabled={busy}>
          {busy ? t.search.searching : t.search.submit}
        </button>
      </form>

      {sourcesState.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {sourcesState.map((s) => (
            <span
              key={s.sourceId}
              className={`badge${s.status === 'error' || s.status === 'zero_results' || s.truncated ? ' warn' : ''}`}
            >
              {s.name}: {t.sourceStatus[s.status as keyof typeof t.sourceStatus] ?? s.status}
              {s.status === 'ok' && ` · ${t.search.itemCount(s.itemsFound)}`}
              {s.truncated && ` · ${t.search.stillMore}`}
            </span>
          ))}
        </div>
      )}

      {message && (
        <p className="badge warn" style={{ display: 'inline-block', marginBottom: 14 }}>
          {message}
        </p>
      )}

      {lastCheckedAt && (
        <p className="muted" style={{ marginTop: 0 }}>
          {t.search.lastChecked(
            new Date(lastCheckedAt).toLocaleString(t.formatLocale, { timeZone: timezone }),
          )}
        </p>
      )}

      {results.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: 14,
          }}
        >
          {results.map((r) => (
            <ListingCard key={r.id} row={r} timezone={timezone} fx={fx} locale={locale} />
          ))}
        </div>
      )}

      {searched && !busy && results.length === 0 && (
        <p className="muted">{t.search.noResults}</p>
      )}
    </>
  )
}
