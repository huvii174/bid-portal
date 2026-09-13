import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession, sessionCookie, type SessionPayload } from './session'

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  return verifySession(store.get(sessionCookie.name)?.value)
}

/** Dùng trong server component/route cần đăng nhập. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession()
  if (session.role !== 'admin') redirect('/search?forbidden=1')
  return session
}
