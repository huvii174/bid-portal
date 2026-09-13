import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import {
  adapterRuns,
  getCacheState,
  getDb,
  getResultsForKeyword,
  searchJobs,
  sources,
} from '@bid/db'
import { getSession } from '../../../../lib/auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { jobId } = await params
  // Chuoi khong phai uuid se lam Postgres nem loi cast -> 500. Chan tu dau.
  if (!UUID_RE.test(jobId)) {
    return NextResponse.json({ error: 'invalid jobId' }, { status: 400 })
  }

  const db = getDb()

  const [job] = await db
    .select()
    .from(searchJobs)
    .where(and(eq(searchJobs.id, jobId), eq(searchJobs.requestedByUserId, session.userId)))
    .limit(1)
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 })

  // Tien do tung nguon: nguon dang bat nao chua co AdapterRun cho job nay thi
  // van dang cho toi luot.
  const enabled = await db.select().from(sources).where(eq(sources.enabled, true))
  const runs = await db
    .select()
    .from(adapterRuns)
    .where(eq(adapterRuns.searchJobId, jobId))
    .orderBy(desc(adapterRuns.startedAt))

  const perSource = enabled.map((source) => {
    const run = runs.find((r) => r.sourceId === source.id)
    return {
      sourceId: source.id,
      name: source.name,
      status: run ? (run.finishedAt ? run.status : 'running') : 'pending',
      itemsFound: run?.itemsFound ?? 0,
      pagesFetched: run?.pagesFetched ?? 0,
      truncated: run?.truncated ?? false,
      errorText: run?.errorText ?? null,
    }
  })

  const finished = job.status === 'done' || job.status === 'partial' || job.status === 'failed'
  const results = finished ? await getResultsForKeyword(db, job.keyword, session.userId) : []
  const cache = finished ? await getCacheState(db, job.keyword) : null

  return NextResponse.json({
    jobId,
    keyword: job.keyword,
    status: job.status,
    finished,
    lastCheckedAt: cache?.lastCheckedAt ?? null,
    sources: perSource,
    results,
  })
}

