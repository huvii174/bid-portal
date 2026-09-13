import { NextResponse, type NextRequest } from 'next/server'
import { verifySession } from './lib/session'
import { DEFAULT_LOCALE, getDictionary } from './i18n'
import { sessionCookie } from './lib/session'

const PUBLIC_PATHS = ['/login', '/api/auth/login']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  const session = await verifySession(req.cookies.get(sessionCookie.name)?.value)

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')
  if (isAdminRoute && session.role !== 'admin') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    // Middleware chay truoc khi doc duoc tuy chon cua user, nen dung mac dinh.
    return new NextResponse(getDictionary(DEFAULT_LOCALE).errors.adminOnly, {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
