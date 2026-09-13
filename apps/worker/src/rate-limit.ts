import { and, gte, sql } from 'drizzle-orm'
import { adapterRuns, settings, type Db } from '@bid/db'

export class PageBudgetExceededError extends Error {
  constructor(used: number, budget: number) {
    super(`ngan sach page-load hom nay da het: ${used}/${budget}`)
  }
}

const DEFAULTS = {
  daily_page_budget: 300,
  pages_per_search: 2,
  keyword_cache_ttl_hours: 6,
} as const

export async function getNumericSetting(
  db: Db,
  key: keyof typeof DEFAULTS,
): Promise<number> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(sql`${settings.key} = ${key}`)
    .limit(1)
  const parsed = Number(row?.value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULTS[key]
}

function startOfUtcDay(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export async function pagesFetchedToday(db: Db): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${adapterRuns.pagesFetched}), 0)::int` })
    .from(adapterRuns)
    .where(and(gte(adapterRuns.startedAt, startOfUtcDay())))
  return row?.total ?? 0
}

/**
 * Chặn cứng tổng số page-load mỗi ngày. Đây là cái phanh thật, không phải
 * "theo dõi usage" — vượt ngưỡng là worker dừng crawl chứ không chỉ cảnh báo.
 */
export async function assertPageBudget(db: Db, wantPages: number): Promise<void> {
  const budget = await getNumericSetting(db, 'daily_page_budget')
  const used = await pagesFetchedToday(db)
  if (used + wantPages > budget) throw new PageBudgetExceededError(used, budget)
}

/** Giãn cách tối thiểu giữa 2 request tới cùng một nguồn, có nhiễu ngẫu nhiên. */
export function createPacer(minIntervalMs: number, jitterRatio = 0.5) {
  let lastAt = 0
  return async function pace(): Promise<void> {
    const jitter = minIntervalMs * jitterRatio * Math.random()
    const wait = lastAt + minIntervalMs + jitter - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastAt = Date.now()
  }
}
