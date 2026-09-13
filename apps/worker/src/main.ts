import { eq, sql } from 'drizzle-orm'
import { getDb, getPool, searchJobs, type Db } from '@bid/db'
import { loadRootEnv } from './env'
import { runSearch } from './pipeline/run-search'

loadRootEnv()

const POLL_INTERVAL_MS = 1500

/**
 * Nhan mot job dang cho. FOR UPDATE SKIP LOCKED de nhieu worker chay song song
 * khong bao gio nhan trung mot job.
 */
async function claimNextJob(db: Db): Promise<{ id: string; keyword: string } | null> {
  const result = await db.execute(sql`
    update search_jobs
       set status = 'running'
     where id = (
       select id from search_jobs
        where status = 'queued'
        order by created_at
        limit 1
        for update skip locked
     )
    returning id, keyword
  `)

  const row = result.rows[0] as { id: string; keyword: string } | undefined
  return row ?? null
}

async function processJob(db: Db, job: { id: string; keyword: string }): Promise<void> {
  console.log(`[job ${job.id}] crawl "${job.keyword}"`)

  const results = await runSearch(db, job.keyword, job.id)
  const active = results.filter((r) => r.status !== 'disabled')
  const failed = active.filter((r) => r.status === 'error' || r.status === 'blocked')

  // partial = co nguon hong nhung van co du lieu tu nguon khac. UI phai noi ro
  // nguon nao hong thay vi im lang tra danh sach thieu.
  const status =
    failed.length === 0 ? 'done' : failed.length === active.length ? 'failed' : 'partial'

  await db
    .update(searchJobs)
    .set({ status, finishedAt: new Date() })
    .where(eq(searchJobs.id, job.id))

  for (const r of results) {
    console.log(`[job ${job.id}] ${r.sourceId}: ${r.status} · ${r.itemsFound} item`)
  }
}

async function loop(): Promise<void> {
  const db = getDb()
  console.log(`worker san sang · poll moi ${POLL_INTERVAL_MS}ms`)

  for (;;) {
    try {
      const job = await claimNextJob(db)
      if (!job) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
        continue
      }

      try {
        await processJob(db, job)
      } catch (err) {
        console.error(`[job ${job.id}] that bai:`, (err as Error).message)
        await db
          .update(searchJobs)
          .set({ status: 'failed', finishedAt: new Date() })
          .where(eq(searchJobs.id, job.id))
      }
    } catch (err) {
      console.error('worker loop loi:', (err as Error).message)
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    }
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\nnhan ${signal}, dong ket noi...`)
    void getPool().end().then(() => process.exit(0))
  })
}

await loop()
