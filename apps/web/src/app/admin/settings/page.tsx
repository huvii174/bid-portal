import { requireAdmin } from '../../../lib/auth'
import { getSetting } from '../../../lib/settings'

const FIELDS = [
  {
    key: 'display_timezone',
    label: 'Múi giờ hiển thị',
    hint: 'Dùng cho đếm ngược và email digest. Ví dụ: Asia/Ho_Chi_Minh',
    fallback: 'Asia/Ho_Chi_Minh',
  },
  {
    key: 'daily_page_budget',
    label: 'Trần lượt tải trang mỗi ngày',
    hint: 'Chạm trần thì worker dừng crawl cho tới hết ngày UTC.',
    fallback: '300',
  },
  {
    key: 'pages_per_search',
    label: 'Số trang lấy mỗi nguồn cho một từ khóa',
    hint: 'HiBid trả 100 món mỗi trang, nên 2 trang là tối đa 200 món.',
    fallback: '2',
  },
  {
    key: 'keyword_cache_ttl_hours',
    label: 'Thời hạn cache kết quả (giờ)',
    hint: 'Trong thời hạn này, tìm lại cùng từ khóa sẽ trả ngay từ kho, không crawl.',
    fallback: '6',
  },
] as const

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; rejected?: string }>
}) {
  await requireAdmin()
  const { saved, rejected } = await searchParams

  const current = await Promise.all(
    FIELDS.map(async (f) => [f.key, await getSetting(f.key, f.fallback)] as const),
  )
  const values = Object.fromEntries(current)

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Cài đặt</h1>

      {saved && (
        <p className="badge" style={{ display: 'inline-block' }}>
          Đã lưu.
        </p>
      )}
      {rejected && (
        <p className="badge warn" style={{ display: 'inline-block' }}>
          Giá trị không hợp lệ, bỏ qua: {rejected}
        </p>
      )}

      <form action="/api/admin/settings" method="post" className="card" style={{ maxWidth: 560 }}>
        {FIELDS.map((f) => (
          <label key={f.key} style={{ display: 'block', marginBottom: 18 }}>
            <div style={{ marginBottom: 4 }}>{f.label}</div>
            <input type="text" name={f.key} defaultValue={values[f.key]} />
            <div className="muted" style={{ marginTop: 4 }}>
              {f.hint}
            </div>
          </label>
        ))}

        <button className="primary" type="submit">
          Lưu
        </button>
      </form>
    </>
  )
}
