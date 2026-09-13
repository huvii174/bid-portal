import { desc, gte, sql } from 'drizzle-orm'
import { adapterRuns, getDb, sources } from '@bid/db'
import { requireAdmin } from '../../../lib/auth'
import { getDisplayTimezone, getSetting } from '../../../lib/settings'
import { SourceToggle } from '../../../components/SourceToggle'

const RUN_LABEL: Record<string, string> = {
  ok: 'ổn',
  error: 'lỗi',
  blocked: 'chạm trần ngân sách',
  zero_results: '0 kết quả (nghi hỏng)',
}

function startOfUtcDay(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export default async function AdminSourcesPage() {
  await requireAdmin()
  const db = getDb()
  const timezone = await getDisplayTimezone()
  const budget = Number(await getSetting('daily_page_budget', '300'))

  const allSources = await db.select().from(sources)
  const runs = await db.select().from(adapterRuns).orderBy(desc(adapterRuns.startedAt)).limit(25)

  const [usage] = await db
    .select({ total: sql<number>`coalesce(sum(${adapterRuns.pagesFetched}), 0)::int` })
    .from(adapterRuns)
    .where(gte(adapterRuns.startedAt, startOfUtcDay()))
  const used = usage?.total ?? 0

  // Worker chet thi khong ai ghi adapter_runs nua — su VANG MAT cua ban ghi la
  // tin hieu duy nhat, nen phai hien ra chu khong the doi no tu bao.
  const lastRunAgeMinutes = runs[0]
    ? (Date.now() - runs[0].startedAt.getTime()) / 60_000
    : null

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Quản trị nguồn</h1>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Ngân sách hôm nay</h2>
        <p style={{ margin: '6px 0' }}>
          <strong>
            {used} / {budget}
          </strong>{' '}
          lượt tải trang (tính theo ngày UTC)
        </p>
        <div
          style={{
            height: 8,
            background: 'var(--surface-2)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, (used / Math.max(budget, 1)) * 100)}%`,
              background: used >= budget ? 'var(--danger)' : 'var(--accent)',
            }}
          />
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Chạm trần thì worker dừng crawl cho tới hết ngày, không phải chỉ cảnh báo.
        </p>
      </section>

      {lastRunAgeMinutes !== null && lastRunAgeMinutes > 60 && (
        <p className="badge warn" style={{ display: 'inline-block', marginBottom: 18 }}>
          Không có lần crawl nào trong {Math.round(lastRunAgeMinutes / 60)} giờ qua — worker có
          thể đã dừng.
        </p>
      )}

      <section style={{ marginBottom: 26 }}>
        <h2 style={{ fontSize: 16 }}>Nguồn</h2>
        <table>
          <thead>
            <tr>
              <th>Nguồn</th>
              <th>Trạng thái</th>
              <th>Giãn cách</th>
              <th>Ghi chú robots.txt</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {allSources.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.name}</strong>
                  <div className="muted">{s.baseUrl}</div>
                </td>
                <td>
                  <span className={`badge${s.enabled ? '' : ' warn'}`}>
                    {s.enabled ? 'đang bật' : 'đã tắt'}
                  </span>
                </td>
                <td>{s.minRequestIntervalMs} ms</td>
                <td className="muted" style={{ maxWidth: 380 }}>
                  {s.robotsNote}
                </td>
                <td>
                  <SourceToggle sourceId={s.id} enabled={s.enabled} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 style={{ fontSize: 16 }}>Lần chạy gần đây</h2>
        {runs.length === 0 ? (
          <p className="muted">Chưa có lần chạy nào.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Bắt đầu</th>
                <th>Nguồn</th>
                <th>Từ khóa</th>
                <th>Kết quả</th>
                <th>Số món</th>
                <th>Trang</th>
                <th>Lỗi</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="muted">
                    {r.startedAt.toLocaleString('vi-VN', { timeZone: timezone })}
                  </td>
                  <td>{r.sourceId}</td>
                  <td>{r.keyword}</td>
                  <td>
                    <span className={`badge${r.status === 'ok' ? '' : ' warn'}`}>
                      {RUN_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td>{r.itemsFound}</td>
                  <td>{r.pagesFetched}</td>
                  <td className="muted" style={{ maxWidth: 280 }}>
                    {r.errorText}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
