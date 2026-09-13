import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb, sources } from '@bid/db'
import { getSession } from '../../../../lib/auth'

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as { sourceId?: string; enabled?: boolean }
  if (!body.sourceId || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'thieu sourceId hoac enabled' }, { status: 400 })
  }

  await getDb()
    .update(sources)
    .set({ enabled: body.enabled })
    .where(eq(sources.id, body.sourceId))

  return NextResponse.json({ ok: true, sourceId: body.sourceId, enabled: body.enabled })
}
