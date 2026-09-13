import { desc } from 'drizzle-orm'
import { adapterRuns, getDb, sources } from '@bid/db'
import { requireAdmin } from '../../../lib/auth'
import { getDisplayTimezone } from '../../../lib/settings'
import { getUserLocale } from '../../../lib/locale'
import { getDictionary } from '../../../i18n'
import { SourceToggle } from '../../../components/SourceToggle'



export default async function AdminSourcesPage() {
  const session = await requireAdmin()
  const db = getDb()
  const timezone = await getDisplayTimezone()
  const locale = await getUserLocale(session.userId)
  const t = getDictionary(locale)

  const allSources = await db.select().from(sources)
  const runs = await db.select().from(adapterRuns).orderBy(desc(adapterRuns.startedAt)).limit(25)


  // Worker chet thi khong ai ghi adapter_runs nua — su VANG MAT cua ban ghi la
  // tin hieu duy nhat, nen phai hien ra chu khong the doi no tu bao.
  const lastRunAgeMinutes = runs[0]
    ? (Date.now() - runs[0].startedAt.getTime()) / 60_000
    : null

  return (
    <>
      <h1 style={{ marginTop: 0 }}>{t.admin.sourcesTitle}</h1>


      {lastRunAgeMinutes !== null && lastRunAgeMinutes > 60 && (
        <p className="badge warn" style={{ display: 'inline-block', marginBottom: 18 }}>
          {t.admin.workerStale(Math.round(lastRunAgeMinutes / 60))}
        </p>
      )}

      <section style={{ marginBottom: 26 }}>
        <h2 style={{ fontSize: 16 }}>{t.admin.colSource}</h2>
        <table>
          <thead>
            <tr>
              <th>{t.admin.colSource}</th>
              <th>{t.admin.colStatus}</th>
              <th>{t.admin.colInterval}</th>
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
                    {s.enabled ? t.admin.enabled : t.admin.disabled}
                  </span>
                </td>
                <td>{s.minRequestIntervalMs} ms</td>
                <td>
                  <SourceToggle sourceId={s.id} enabled={s.enabled} locale={locale} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 style={{ fontSize: 16 }}>{t.admin.recentRuns}</h2>
        {runs.length === 0 ? (
          <p className="muted">{t.admin.noRuns}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t.admin.colStarted}</th>
                <th>{t.admin.colSource}</th>
                <th>{t.admin.colKeyword}</th>
                <th>{t.admin.colResult}</th>
                <th>{t.admin.colItems}</th>
                <th>{t.admin.colPages}</th>
                <th>{t.admin.colError}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="muted">
                    {r.startedAt.toLocaleString(t.formatLocale, { timeZone: timezone })}
                  </td>
                  <td>{r.sourceId}</td>
                  <td>{r.keyword}</td>
                  <td>
                    <span className={`badge${r.status === 'ok' ? '' : ' warn'}`}>
                      {t.runStatus[r.status as keyof typeof t.runStatus] ?? r.status}
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
