export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const { error, next } = await searchParams

  return (
    <div style={{ maxWidth: 380, margin: '8vh auto' }}>
      <h1 style={{ marginBottom: 4 }}>Bid Portal</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: 22 }}>
        Tổng hợp đồ cổ đấu giá từ nhiều sàn về một nơi.
      </p>

      <form className="card" action="/api/auth/login" method="post">
        <input type="hidden" name="next" value={next ?? '/search'} />

        <label>
          <div className="muted" style={{ marginBottom: 4 }}>
            Email
          </div>
          <input type="email" name="email" required autoFocus autoComplete="username" />
        </label>

        <label style={{ display: 'block', marginTop: 14 }}>
          <div className="muted" style={{ marginBottom: 4 }}>
            Mật khẩu
          </div>
          <input type="password" name="password" required autoComplete="current-password" />
        </label>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 0 }}>
            Email hoặc mật khẩu không đúng.
          </p>
        )}

        <button className="primary" type="submit" style={{ width: '100%', marginTop: 18 }}>
          Đăng nhập
        </button>
      </form>
    </div>
  )
}
