import { and, desc, eq, gt, sql } from 'drizzle-orm'
import { adapterRuns, listingKeywords, notifications, users, type Db } from '@bid/db'
import type { AdapterRunStatus } from '@bid/db/schema'
import { sendAlert } from '../notify/alert'

export interface RunOutcome {
  status: AdapterRunStatus
  itemsFound: number
  pagesFetched: number
  errorText?: string
}

export async function startRun(
  db: Db,
  sourceId: string,
  keyword: string,
  searchJobId?: string,
): Promise<string> {
  const [row] = await db
    .insert(adapterRuns)
    .values({ sourceId, keyword, searchJobId, status: 'ok' })
    .returning({ id: adapterRuns.id })
  return row!.id
}

/**
 * Mot lan crawl tra ve 0 ket qua CHO TU KHOA TUNG CO KET QUA la dau hieu
 * adapter hong chu khong phai thi truong het hang. Day la che do hong nguy
 * hiem nhat: doi van thay giao dien binh thuong nhung danh sach thieu.
 */
async function isSuspiciousZero(
  db: Db,
  sourceId: string,
  keyword: string,
): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listingKeywords)
    .where(and(eq(listingKeywords.sourceId, sourceId), eq(listingKeywords.keyword, keyword)))
  return (row?.n ?? 0) > 0
}

export async function finishRun(
  db: Db,
  runId: string,
  sourceId: string,
  keyword: string,
  outcome: RunOutcome,
): Promise<AdapterRunStatus> {
  let status = outcome.status

  if (status === 'ok' && outcome.itemsFound === 0 && (await isSuspiciousZero(db, sourceId, keyword))) {
    status = 'zero_results'
  }

  await db
    .update(adapterRuns)
    .set({
      status,
      itemsFound: outcome.itemsFound,
      pagesFetched: outcome.pagesFetched,
      errorText: outcome.errorText,
      finishedAt: new Date(),
    })
    .where(eq(adapterRuns.id, runId))

  if (status !== 'ok') {
    await alertAdmins(db, sourceId, keyword, status, outcome.errorText)
  }

  return status
}

/** Dashboard chi huu ich neu co nguoi mo no — nen loi phai duoc day ra email. */
async function alertAdmins(
  db: Db,
  sourceId: string,
  keyword: string,
  status: AdapterRunStatus,
  errorText?: string,
): Promise<void> {
  const admins = await db.select().from(users).where(eq(users.role, 'admin'))
  if (admins.length === 0) return

  const subject = `[Bid Portal] nguon ${sourceId}: ${status}`
  const body = [
    `Nguon: ${sourceId}`,
    `Tu khoa: ${keyword}`,
    `Trang thai: ${status}`,
    errorText ? `Loi: ${errorText}` : '',
    '',
    status === 'zero_results'
      ? 'Tu khoa nay truoc day CO ket qua nhung lan chay vua roi tra ve 0. Rat co the adapter da hong chu khong phai het hang.'
      : '',
    'Kiem tra tai /admin/sources.',
  ]
    .filter(Boolean)
    .join('\n')

  for (const admin of admins) {
    await sendAlert(admin.email, subject, body)
    await db.insert(notifications).values({
      userId: admin.id,
      kind: 'adapter_alert',
      payloadJson: { sourceId, keyword, status, errorText },
    })
  }
}

export async function recentRuns(db: Db, limit = 50) {
  return db.select().from(adapterRuns).orderBy(desc(adapterRuns.startedAt)).limit(limit)
}

export { gt }
