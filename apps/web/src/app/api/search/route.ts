import { NextResponse } from 'next/server'
import {
  getCacheState,
  getDb,
  getResultsForKeyword,
  normalizeKeyword,
  searchJobs,
} from '@bid/db'
import { getSession } from '../../../lib/auth'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { keyword?: string }
  const keyword = normalizeKeyword(body.keyword ?? '')
  if (!keyword) return NextResponse.json({ error: 'thieu tu khoa' }, { status: 400 })

  const db = getDb()
  const cache = await getCacheState(db, keyword)

  // Cache con han -> tra ngay tu index (AC1b).
  if (cache.fresh) {
    const results = await getResultsForKeyword(db, keyword, session.userId)
    return NextResponse.json({
      mode: 'cached',
      keyword,
      lastCheckedAt: cache.lastCheckedAt,
      results,
    })
  }

  // Het han -> dua vao hang doi, UI se poll (AC1a).
  const [job] = await db
    .insert(searchJobs)
    .values({ keyword, requestedByUserId: session.userId, status: 'queued' })
    .returning({ id: searchJobs.id })

  return NextResponse.json({ mode: 'queued', keyword, jobId: job!.id })
}
