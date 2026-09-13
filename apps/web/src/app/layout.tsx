import './globals.css'
import type { ReactNode } from 'react'
import { getSession } from '../lib/auth'
import { getFxContext } from '../lib/fx'
import { getUserLocale } from '../lib/locale'
import { DEFAULT_LOCALE, getDictionary } from '../i18n'
import { CurrencyPicker } from '../components/CurrencyPicker'
import { LocalePicker } from '../components/LocalePicker'

export const metadata = {
  title: 'Bid Portal',
  description: 'Antique auction lots from several houses, in one place',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  const locale = session ? await getUserLocale(session.userId) : DEFAULT_LOCALE
  const fx = session ? await getFxContext(session.userId) : null
  const t = getDictionary(locale)

  return (
    <html lang={t.htmlLang}>
      <body>
        {session && (
          <header className="topbar">
            <div className="wrap">
              <a className="brand" href="/search">
                {t.app.name}
              </a>
              <nav className="links">
                <a href="/search">{t.nav.search}</a>
                <a href="/watchlist">{t.nav.watchlist}</a>
                {session.role === 'admin' && (
                  <>
                    <a href="/admin/sources">{t.nav.sources}</a>
                    <a href="/admin/settings">{t.nav.settings}</a>
                  </>
                )}
                <LocalePicker value={locale} />
                <CurrencyPicker value={fx?.displayCurrency ?? null} locale={locale} />
                <span className="muted">{session.email}</span>
                <form action="/api/auth/logout" method="post">
                  <button type="submit">{t.nav.signOut}</button>
                </form>
              </nav>
            </div>
          </header>
        )}
        <main className="wrap" style={{ paddingBlock: 24 }}>
          {children}
        </main>
      </body>
    </html>
  )
}
