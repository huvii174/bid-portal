import { DEFAULT_LOCALE, getDictionary } from '../../i18n'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const { error, next } = await searchParams
  // Chua dang nhap nen chua biet tuy chon cua ai — dung mac dinh.
  const t = getDictionary(DEFAULT_LOCALE)

  return (
    <div style={{ maxWidth: 380, margin: '8vh auto' }}>
      <h1 style={{ marginBottom: 4 }}>{t.app.name}</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: 22 }}>
        {t.app.tagline}
      </p>

      <form className="card" action="/api/auth/login" method="post">
        <input type="hidden" name="next" value={next ?? '/search'} />

        <label>
          <div className="muted" style={{ marginBottom: 4 }}>
            {t.login.email}
          </div>
          <input type="email" name="email" required autoFocus autoComplete="username" />
        </label>

        <label style={{ display: 'block', marginTop: 14 }}>
          <div className="muted" style={{ marginBottom: 4 }}>
            {t.login.password}
          </div>
          <input type="password" name="password" required autoComplete="current-password" />
        </label>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 0 }}>
            {t.login.failed}
          </p>
        )}

        <button className="primary" type="submit" style={{ width: '100%', marginTop: 18 }}>
          {t.login.submit}
        </button>
      </form>
    </div>
  )
}
