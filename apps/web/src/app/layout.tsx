import './globals.css'
import type { ReactNode } from 'react'
import { getSession } from '../lib/auth'

export const metadata = {
  title: 'Bid Portal',
  description: 'Tổng hợp đồ cổ đấu giá từ nhiều sàn về một nơi',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession()

  return (
    <html lang="vi">
      <body>
        {session && (
          <header className="topbar">
            <div className="wrap">
              <a className="brand" href="/search">
                Bid Portal
              </a>
              <nav className="links">
                <a href="/search">Tìm kiếm</a>
                <a href="/watchlist">Quan tâm</a>
                {session.role === 'admin' && <a href="/admin/sources">Quản trị</a>}
                <span className="muted">{session.email}</span>
                <form action="/api/auth/logout" method="post">
                  <button type="submit">Thoát</button>
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
