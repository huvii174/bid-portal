import { NextResponse } from 'next/server'
import { sessionCookie } from '../../../../lib/session'

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/login', req.url), 303)
  res.cookies.set(sessionCookie.name, '', { ...sessionCookie.options, maxAge: 0 })
  return res
}
