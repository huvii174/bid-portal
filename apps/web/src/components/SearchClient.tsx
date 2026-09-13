'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ListingCard, type ResultRow } from './ListingCard'

interface SourceProgress {
  sourceId: string
  name: string
  status: string
  itemsFound: number
  pagesFetched: number
  truncated: boolean
  errorText: string | null
}

const SOURCE_LABEL: Record<string, string> = {
  pending: 'đang chờ',
  running: 'đang lấy dữ liệu',
  ok: 'xong',
  zero_results: 'không có kết quả (nghi adapter hỏng)',
  error: 'lỗi',
  blocked: 'đã chạm trần ngân sách',
}

export function SearchClient({ timezone, initialKeyword }: { timezone: string; initialKeyword: string }) {
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
      setMessage('Tìm kiếm quá lâu không phản hồi. Thử lại, hoặc kiểm tra worker còn chạy không.')
      setBusy(false)
      return
    }

    const res = await fetch(`/api/search/${jobId}`)
    if (!res.ok) {
      setMessage('Không đọc được tiến độ tìm kiếm.')
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

    if (data.status === 'failed') setMessage('Tất cả nguồn đều lỗi — xem chi tiết bên dưới.')
    else if (data.status === 'partial') setMessage('Một số nguồn lỗi — danh sách dưới đây chưa đầy đủ.')
    else setMessage(null)
  }, [])

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
        setMessage('Tìm kiếm thất bại.')
        setBusy(false)
        return
      }

      const data = await res.json()
      if (data.mode === 'cached') {
        setResults(data.results ?? [])
        setLastCheckedAt(data.lastCheckedAt ?? null)
        setBusy(false)
        return
      }

      void poll(data.jobId)
    },
    [busy, poll],
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
          placeholder="Ví dụ: tiffany lamp, rococo table, bronze statue…"
          aria-label="Từ khóa tìm kiếm"
        />
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Đang tìm…' : 'Tìm'}
        </button>
      </form>

      {sourcesState.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {sourcesState.map((s) => (
            <span
              key={s.sourceId}
              className={`badge${s.status === 'error' || s.status === 'zero_results' || s.truncated ? ' warn' : ''}`}
            >
              {s.name}: {SOURCE_LABEL[s.status] ?? s.status}
              {s.status === 'ok' && ` · ${s.itemsFound} món`}
              {s.truncated && ' · còn nữa, chưa lấy hết'}
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
          Kiểm tra lần cuối:{' '}
          {new Date(lastCheckedAt).toLocaleString('vi-VN', { timeZone: timezone })}
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
            <ListingCard key={r.id} row={r} timezone={timezone} />
          ))}
        </div>
      )}

      {searched && !busy && results.length === 0 && (
        <p className="muted">Không tìm thấy món nào khớp từ khóa này.</p>
      )}
    </>
  )
}
