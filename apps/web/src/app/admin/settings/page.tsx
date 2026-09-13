import { requireAdmin } from '../../../lib/auth'
import { getSetting } from '../../../lib/settings'
import { getUserLocale } from '../../../lib/locale'
import { getDictionary, type Dictionary } from '../../../i18n'

const fields = (t: Dictionary) =>
  [
    {
      key: 'display_timezone',
      label: t.admin.timezoneLabel,
      hint: t.admin.timezoneHint,
      fallback: 'Asia/Ho_Chi_Minh',
    },
    {
      key: 'pages_per_search',
      label: t.admin.pagesLabel,
      hint: t.admin.pagesHint,
      fallback: '2',
    },
    {
      key: 'keyword_cache_ttl_hours',
      label: t.admin.cacheLabel,
      hint: t.admin.cacheHint,
      fallback: '6',
    },
  ] as const

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; rejected?: string }>
}) {
  const session = await requireAdmin()
  const { saved, rejected } = await searchParams
  const t = getDictionary(await getUserLocale(session.userId))
  const FIELDS = fields(t)

  const current = await Promise.all(
    FIELDS.map(async (f) => [f.key, await getSetting(f.key, f.fallback)] as const),
  )
  const values = Object.fromEntries(current)

  return (
    <>
      <h1 style={{ marginTop: 0 }}>{t.admin.settingsTitle}</h1>

      {saved && (
        <p className="badge" style={{ display: 'inline-block' }}>
          {t.admin.saved}
        </p>
      )}
      {rejected && (
        <p className="badge warn" style={{ display: 'inline-block' }}>
          {t.admin.rejected(rejected)}
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
          {t.admin.save}
        </button>
      </form>
    </>
  )
}
