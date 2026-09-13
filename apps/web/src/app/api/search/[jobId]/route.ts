import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import {
  adapterRuns,
  getCacheState,
  getDb,
  getResultsForKeyword,
  searchJobs,
  sources,
} from '@bid/db'
import { getSession } from '../../../../lib/auth'

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { jobId } = await params
  const db = getDb()

  const [job] = await db.select().from(searchJobs).where(eq(searchJobs.id, jobId)).limit(1)
  if (!job) return NextResponse.json({ error: 'khong tim thay job' }, { status: 404 })

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

