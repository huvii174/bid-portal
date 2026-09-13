'use client'

import { useState } from 'react'
import { convertCurrency } from '@bid/db/currency'

export interface ResultRow {
  id: string
  sourceId: string
  url: string
  title: string
  thumbUrl: string | null
  lotNo: string | null
  currency: string | null
  priceKind: string
  priceAmount: string | null
  priceAmountHigh: string | null
  estimateLow: string | null
  estimateHigh: string | null
  rawEstimateText: string | null
  endsAtUtc: string | null
  endTimeIsApproximate: boolean
  status: string
  houseName: string | null
  watchlisted: boolean
}

const SOURCE_NAME: Record<string, string> = {
  hibid: 'HiBid',
  liveauctioneers: 'LiveAuctioneers',
  invaluable: 'Invaluable',
}

/** Nhãn phải nói rõ đây là loại giá gì — không bao giờ để người xem tự đoán. */
const PRICE_LABEL: Record<string, string> = {
  current_bid: 'Giá hiện tại',
  starting_bid: 'Giá khởi điểm',
  buy_now: 'Mua ngay',
  sold: 'Đã bán',
  estimate: 'Ước tính',
  unknown: 'Chưa có giá',
}

const STATUS_LABEL: Record<string, string> = {
  ended: 'Đã kết thúc',
  sold: 'Đã bán',
  withdrawn: 'Đã gỡ',
  stale: 'Có thể đã gỡ',
}

function money(amount: string | null, currency: string | null): string | null {
  if (amount === null) return null
  const n = Number(amount)
  if (!Number.isFinite(n)) return null
  const formatted = n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
  return currency ? `${formatted} ${currency}` : formatted
}

/**
 * Khoảng giá. Một giá trị đơn (low = high) hiện gọn "400 USD" chứ không phải
 * "400–400 USD"; ngược lại, khoảng thật PHẢI hiện đủ cả hai đầu — cắt còn cận
 * dưới sẽ biến "ước tính 2.000–4.000" thành "2.000", đúng kiểu hiển thị sai giá
 * mà cả mô hình dữ liệu này sinh ra để ngăn.
 */
function range(low: string | null, high: string | null, currency: string | null): string | null {
  if (low === null) return null
  const lowNum = Number(low)
  if (!Number.isFinite(lowNum)) return null

  const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
  const suffix = currency ? ` ${currency}` : ''
  const highNum = high === null ? null : Number(high)

  return highNum !== null && Number.isFinite(highNum) && highNum !== lowNum
    ? `${fmt(lowNum)}–${fmt(highNum)}${suffix}`
    : `${fmt(lowNum)}${suffix}`
}

function estimateText(row: ResultRow): string | null {
  return range(row.estimateLow, row.estimateHigh, row.currency)
}

function countdown(endsAtUtc: string | null): string | null {
  if (!endsAtUtc) return null
  const ms = new Date(endsAtUtc).getTime() - Date.now()
  if (!Number.isFinite(ms)) return null
  if (ms <= 0) return 'đã đóng'

  const mins = Math.floor(ms / 60000)
  const days = Math.floor(mins / 1440)
  if (days >= 1) return `còn ${days} ngày`
  const hours = Math.floor(mins / 60)
  if (hours >= 1) return `còn ${hours} giờ`
  return `còn ${mins} phút`
}

export interface FxProps {
  displayCurrency: string | null
  perUsd: Record<string, number>
}

export function ListingCard({
  row,
  timezone,
  fx,
}: {
  row: ResultRow
  timezone: string
  fx?: FxProps
}) {
  const [watchlisted, setWatchlisted] = useState(row.watchlisted)
  const [pending, setPending] = useState(false)

  // Khi priceKind='estimate' thi gia chinh CHINH LA khoang uoc tinh, nen phai
  // hien ca hai dau; cac loai gia khac la mot con so don.
  const price =
    row.priceKind === 'estimate'
      ? range(row.priceAmount, row.priceAmountHigh, row.currency)
      : money(row.priceAmount, row.currency)
  const estimate = estimateText(row)
  // Chi hien estimate rieng khi no KHONG phai gia chinh dang hien.
  const showEstimate = estimate && row.priceKind !== 'estimate'
  const remaining = countdown(row.endsAtUtc)
  const endedBadge = STATUS_LABEL[row.status]

  // Quy doi chi de SO SANH. Gia goc o tren van la so tien thuc phai tra, nen
  // no giu vai tro chinh; thieu ty gia thi khong hien gi ca, khong bao gio doan.
  const converted =
    fx?.displayCurrency && row.currency && row.priceAmount !== null
      ? convertCurrency({
          amount: Number(row.priceAmount),
          from: row.currency,
          to: fx.displayCurrency,
          perUsd: fx.perUsd,
        })
      : null

  async function toggleWatch() {
    if (pending) return
    setPending(true)
    const res = await fetch('/api/watchlist', {
      method: watchlisted ? 'DELETE' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ listingId: row.id }),
    })
    if (res.ok) setWatchlisted(!watchlisted)
    setPending(false)
  }

  return (
    <article className="card" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {row.thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.thumbUrl}
          alt=""
          loading="lazy"
          style={{
            width: '100%',
            aspectRatio: '1 / 1',
            objectFit: 'cover',
            borderRadius: 6,
            background: 'var(--surface-2)',
          }}
        />
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="badge source">{SOURCE_NAME[row.sourceId] ?? row.sourceId}</span>
        {endedBadge && <span className="badge warn">{endedBadge}</span>}
        {row.lotNo && <span className="badge">Lô {row.lotNo}</span>}
      </div>

      <h3 style={{ margin: 0, fontSize: 15, lineHeight: 1.35 }}>{row.title}</h3>

      <div>
        <div style={{ fontWeight: 600 }}>
          <span className="muted" style={{ fontWeight: 400 }}>
            {PRICE_LABEL[row.priceKind] ?? row.priceKind}:{' '}
          </span>
          {price ?? '—'}
        </div>
        {converted !== null && row.currency !== fx?.displayCurrency && (
          <div className="muted" title="Quy đổi tham khảo theo tỷ giá cập nhật hằng ngày">
            ≈ {converted.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}{' '}
            {fx?.displayCurrency}
          </div>
        )}
        {showEstimate && (
          <div className="muted" title={row.rawEstimateText ?? undefined}>
            Ước tính: {estimate}
          </div>
        )}
        {!row.currency && price && (
          <div className="muted" title="Nguồn không kèm thông tin tiền tệ cho món này">
            (không rõ tiền tệ)
          </div>
        )}
      </div>

      <div className="muted">
        {row.houseName && <div>{row.houseName}</div>}
        {remaining && (
          <div
            title={
              row.endsAtUtc
                ? `${new Date(row.endsAtUtc).toLocaleString('vi-VN', { timeZone: timezone })} (giờ ${timezone})`
                : undefined
            }
          >
            {remaining}
            {row.endTimeIsApproximate && ' (phiên live, giờ đóng chỉ là ước lượng)'}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
        <a
          className="btn"
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ flex: 1, textAlign: 'center' }}
        >
          Xem trên {SOURCE_NAME[row.sourceId] ?? row.sourceId}
        </a>
        <button onClick={toggleWatch} disabled={pending} aria-pressed={watchlisted}>
          {watchlisted ? '★' : '☆'}
        </button>
      </div>
    </article>
  )
}
