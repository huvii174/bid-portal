import { requireSession } from '../../lib/auth'
import { getDisplayTimezone } from '../../lib/settings'
import { SearchClient } from '../../components/SearchClient'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; forbidden?: string }>
}) {
  await requireSession()
  const { q, forbidden } = await searchParams
  const timezone = await getDisplayTimezone()

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Tìm hàng</h1>
      {forbidden && (
        <p className="badge warn" style={{ display: 'inline-block' }}>
          Bạn không có quyền vào trang quản trị.
        </p>
      )}
      <SearchClient timezone={timezone} initialKeyword={q ?? ''} />
    </>
  )
}
