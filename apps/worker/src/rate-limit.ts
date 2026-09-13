import { sql } from 'drizzle-orm'
import { settings, type Db } from '@bid/db'

const DEFAULTS = {
  pages_per_search: 2,
  keyword_cache_ttl_hours: 6,
} as const

export async function getNumericSetting(db: Db, key: keyof typeof DEFAULTS): Promise<number> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(sql`${settings.key} = ${key}`)
    .limit(1)
  const parsed = Number(row?.value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULTS[key]
}

/**
 * Giãn cách tối thiểu giữa 2 request tới cùng một nguồn, có nhiễu ngẫu nhiên.
 *
 * Đây là cơ chế duy nhất giới hạn nhịp gọi tới nguồn, nên đừng tạo pacer mới
 * cho mỗi job — một thể hiện dùng chung cho cả tiến trình mới giữ được giãn
 * cách giữa các lần crawl liên tiếp.
 */
export function createPacer(minIntervalMs: number, jitterRatio = 0.5) {
  let lastAt = 0
  return async function pace(): Promise<void> {
    const jitter = minIntervalMs * jitterRatio * Math.random()
    const wait = lastAt + minIntervalMs + jitter - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastAt = Date.now()
  }
}
