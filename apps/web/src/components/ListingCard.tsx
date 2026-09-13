'use client'

import { useEffect, useState } from 'react'
import { convertCurrency } from '@bid/db/currency'
import { getDictionary, type Locale } from '../i18n'

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


function money(amount: string | null, currency: string | null, fmt: string): string | null {
  if (amount === null) return null
  const n = Number(amount)
  if (!Number.isFinite(n)) return null
  const formatted = n.toLocaleString(fmt, { maximumFractionDigits: 2 })
  return currency ? `${formatted} ${currency}` : formatted
}

/**
 * Khoảng giá. Một giá trị đơn (low = high) hiện gọn "400 USD" chứ không phải
 * "400–400 USD"; ngược lại, khoảng thật PHẢI hiện đủ cả hai đầu — cắt còn cận
 * dưới sẽ biến "ước tính 2.000–4.000" thành "2.000", đúng kiểu hiển thị sai giá
 * mà cả mô hình dữ liệu này sinh ra để ngăn.
 */
function range(
  low: string | null,
  high: string | null,
  currency: string | null,
  fmt: string,
): string | null {
  if (low === null) return null
  const lowNum = Number(low)
  if (!Number.isFinite(lowNum)) return null

  const show = (n: number) => n.toLocaleString(fmt, { maximumFractionDigits: 2 })
  const suffix = currency ? ` ${currency}` : ''
  const highNum = high === null ? null : Number(high)

  return highNum !== null && Number.isFinite(highNum) && highNum !== lowNum
    ? `${show(lowNum)}–${show(highNum)}${suffix}`
    : `${show(lowNum)}${suffix}`
}

function estimateText(row: ResultRow, fmt: string): string | null {
  return range(row.estimateLow, row.estimateHigh, row.currency, fmt)
}

/**
 * Dem nguoc phu thuoc Date.now() nen may chu va trinh duyet tinh ra hai gia tri
 * khac nhau neu vuot qua moc phut — dung kieu lech hydration ma React canh bao.
 * Vi vay chi tinh SAU khi mount; may chu khong render gi cho o nay.
 */
function useCountdown(endsAtUtc: string | null, locale: Locale): string | null {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => setText(countdown(endsAtUtc, locale)), [endsAtUtc, locale])
  return text
}

function countdown(endsAtUtc: string | null, locale: Locale): string | null {
  if (!endsAtUtc) return null
  const ms = new Date(endsAtUtc).getTime() - Date.now()
  if (!Number.isFinite(ms)) return null

  const t = getDictionary(locale)
  if (ms <= 0) return t.card.closed

  const mins = Math.floor(ms / 60000)
  const days = Math.floor(mins / 1440)
  if (days >= 1) return t.card.daysLeft(days)
  const hours = Math.floor(mins / 60)
  if (hours >= 1) return t.card.hoursLeft(hours)
  return t.card.minutesLeft(mins)
}

export interface FxProps {
  displayCurrency: string | null
  perUsd: Record<string, number>
}

export function ListingCard({
  row,
  timezone,
  fx,
  locale,
}: {
  row: ResultRow
  timezone: string
  fx?: FxProps
  locale: Locale
}) {
  const t = getDictionary(locale)
  const fmt = t.formatLocale
  const [watchlisted, setWatchlisted] = useState(row.watchlisted)
  const [pending, setPending] = useState(false)

  // Khi priceKind='estimate' thi gia chinh CHINH LA khoang uoc tinh, nen phai
  // hien ca hai dau; cac loai gia khac la mot con so don.
  const price =
    row.priceKind === 'estimate'
      ? range(row.priceAmount, row.priceAmountHigh, row.currency, fmt)
      : money(row.priceAmount, row.currency, fmt)
  const estimate = estimateText(row, fmt)
  // Chi hien estimate rieng khi no KHONG phai gia chinh dang hien.
  const showEstimate = estimate && row.priceKind !== 'estimate'
  const remaining = useCountdown(row.endsAtUtc, locale)
  const endedBadge = t.listingStatus[row.status as keyof typeof t.listingStatus]

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
        {row.lotNo && <span className="badge">{t.card.lot(row.lotNo)}</span>}
      </div>

      <h3 style={{ margin: 0, fontSize: 15, lineHeight: 1.35 }}>{row.title}</h3>

      <div>
        <div style={{ fontWeight: 600 }}>
          <span className="muted" style={{ fontWeight: 400 }}>
            {t.priceKind[row.priceKind as keyof typeof t.priceKind] ?? row.priceKind}:{' '}
          </span>
          {price ?? t.card.noPrice}
        </div>
        {converted !== null && row.currency !== fx?.displayCurrency && (
          <div className="muted" title={t.card.convertedHint}>
            ≈ {converted.toLocaleString(fmt, { maximumFractionDigits: 0 })} {fx?.displayCurrency}
          </div>
        )}
        {showEstimate && (
          <div className="muted" title={row.rawEstimateText ?? undefined}>
            {t.card.estimate(estimate!)}
          </div>
        )}
        {!row.currency && price && (
          <div className="muted" title={t.card.unknownCurrencyHint}>
            {t.card.unknownCurrency}
          </div>
        )}
      </div>

      <div className="muted">
        {row.houseName && <div>{row.houseName}</div>}
        {remaining && (
          <div
            title={
              row.endsAtUtc
                ? t.card.endsAtHint(
                    new Date(row.endsAtUtc).toLocaleString(fmt, { timeZone: timezone }),
                    timezone,
                  )
                : undefined
            }
          >
            {remaining}
            {row.endTimeIsApproximate && ` ${t.card.liveApproximate}`}
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
          {t.card.viewOn(SOURCE_NAME[row.sourceId] ?? row.sourceId)}
        </a>
        <button
          onClick={toggleWatch}
          disabled={pending}
          aria-pressed={watchlisted}
          aria-label={watchlisted ? t.card.watchRemove : t.card.watchAdd}
          title={watchlisted ? t.card.watchRemove : t.card.watchAdd}
        >
          {watchlisted ? '★' : '☆'}
        </button>
      </div>
    </article>
  )
}
