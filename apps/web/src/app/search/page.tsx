import { requireSession } from '../../lib/auth'
import { getFxContext } from '../../lib/fx'
import { getUserLocale } from '../../lib/locale'
import { getDictionary } from '../../i18n'
import { getDisplayTimezone } from '../../lib/settings'
import { SearchClient } from '../../components/SearchClient'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; forbidden?: string }>
}) {
  const session = await requireSession()
  const { q, forbidden } = await searchParams
  const timezone = await getDisplayTimezone()
  const fx = await getFxContext(session.userId)
  const locale = await getUserLocale(session.userId)
  const t = getDictionary(locale)

  return (
    <>
      <h1 style={{ marginTop: 0 }}>{t.search.title}</h1>
      {forbidden && (
        <p className="badge warn" style={{ display: 'inline-block' }}>
          {t.search.forbidden}
        </p>
      )}
      <SearchClient timezone={timezone} initialKeyword={q ?? ''} fx={fx} locale={locale} />
    </>
  )
}
