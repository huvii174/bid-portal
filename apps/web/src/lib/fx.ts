import { eq } from 'drizzle-orm'
import { fxRates, getDb, users } from '@bid/db'

export interface FxContext {
  displayCurrency: string | null
  perUsd: Record<string, number>
}

/** Khong co ty gia thi tra ve rong — card se chi hien gia goc, khong doan. */
export async function getFxContext(userId: string): Promise<FxContext> {
  const db = getDb()

  const [user] = await db
    .select({ displayCurrency: users.displayCurrency })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const displayCurrency = user?.displayCurrency ?? null
  if (!displayCurrency) return { displayCurrency: null, perUsd: {} }

  const rows = await db.select().from(fxRates)
  const perUsd: Record<string, number> = {}
  for (const r of rows) {
    const n = Number(r.perUsd)
    if (Number.isFinite(n) && n > 0) perUsd[r.currency] = n
  }

  return { displayCurrency, perUsd }
}
